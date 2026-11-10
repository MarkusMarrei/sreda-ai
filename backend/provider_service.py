"""SREDA AI - External Cloud API Providers Service
Integrates OpenRouter, Sber GigaChat (OAuth 2.0 with Russian root CA support),
and custom OpenAI-compatible endpoints with client credentials, RAG, and tools.
"""

import base64
import json
import logging
import os
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional
import urllib3
import requests

# Disable InsecureRequestWarning for Sber GigaChat Russian Root CA hosts
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger("sreda.providers")

DEFAULT_PROVIDERS_CONFIG = {
    "openrouter": {
        "enabled": False,
        "api_key": "",
        "model": "deepseek/deepseek-chat",
        "available_models": [
            {"id": "deepseek/deepseek-chat", "name": "DeepSeek V3 (Chat)"},
            {"id": "deepseek/deepseek-r1", "name": "DeepSeek R1 (Reasoning)"},
            {"id": "anthropic/claude-3.5-sonnet", "name": "Claude 3.5 Sonnet"},
            {"id": "meta-llama/llama-3.3-70b-instruct", "name": "Llama 3.3 70B Instruct"},
            {"id": "google/gemini-2.0-flash-exp:free", "name": "Gemini 2.0 Flash (Free)"},
            {"id": "openai/gpt-4o", "name": "GPT-4o (OpenAI)"}
        ]
    },
    "gigachat": {
        "enabled": False,
        "client_id": "",
        "client_secret": "",
        "auth_key": "",
        "scope": "GIGACHAT_API_PERS",
        "model": "GigaChat-2-Max",
        "available_models": [
            {"id": "GigaChat-2-Max", "name": "GigaChat 2 Max (Флагман Сбера)"},
            {"id": "GigaChat-2-Pro", "name": "GigaChat 2 Pro (Аналитика и код)"},
            {"id": "GigaChat-2", "name": "GigaChat 2 (Базовая модель)"},
            {"id": "GigaChat", "name": "GigaChat 1.x (Классическая)"}
        ]
    },
    "custom": {
        "enabled": False,
        "name": "Пользовательский API (OpenAI Compatible)",
        "base_url": "https://api.deepseek.com/v1",
        "api_key": "",
        "model": "deepseek-chat",
        "available_models": [
            {"id": "deepseek-chat", "name": "deepseek-chat"}
        ]
    }
}

class ProviderService:
    def __init__(self, base_dir: Path):
        self.base_dir = Path(base_dir)
        self.config_dir = self.base_dir / "backend" / "config"
        self.config_dir.mkdir(parents=True, exist_ok=True)
        self.config_file = self.config_dir / "providers.json"

        self.gigachat_token: Optional[str] = None
        self.gigachat_token_expires: float = 0.0

        self.config = self._load_config()

    def _load_config(self) -> Dict[str, Any]:
        if self.config_file.exists():
            try:
                with open(self.config_file, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    # Merge with default structure to prevent missing keys
                    for prov, def_val in DEFAULT_PROVIDERS_CONFIG.items():
                        if prov not in cfg:
                            cfg[prov] = def_val
                        else:
                            for k, v in def_val.items():
                                if k not in cfg[prov]:
                                    cfg[prov][k] = v
                    return cfg
            except Exception as e:
                logger.warning(f"Could not load providers.json: {e}")
        return json.loads(json.dumps(DEFAULT_PROVIDERS_CONFIG))

    def save_config(self, cfg: Dict[str, Any]) -> bool:
        try:
            self.config = cfg
            with open(self.config_file, "w", encoding="utf-8") as f:
                json.dump(cfg, f, ensure_ascii=False, indent=2)
            # Invalidate cached gigachat token on credentials change
            self.gigachat_token = None
            self.gigachat_token_expires = 0.0
            return True
        except Exception as e:
            logger.error(f"Could not save providers.json: {e}")
            return False

    def get_gigachat_token(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        auth_key: Optional[str] = None,
        scope: Optional[str] = None
    ) -> str:
        """Fetch or refresh OAuth token for Sber GigaChat API with Russian CA SSL bypass."""
        now = time.time()
        # Return cached token if valid for at least another 60 seconds and no custom credentials passed
        if (
            self.gigachat_token
            and (self.gigachat_token_expires - now) > 60
            and not client_id
            and not client_secret
            and not auth_key
        ):
            return self.gigachat_token

        g_cfg = self.config.get("gigachat", {})
        cid = (client_id if client_id is not None else g_cfg.get("client_id", "")).strip()
        sec = (client_secret if client_secret is not None else g_cfg.get("client_secret", "")).strip()
        key = (auth_key if auth_key is not None else g_cfg.get("auth_key", "")).strip()
        sc = (scope or g_cfg.get("scope", "GIGACHAT_API_PERS")).strip()

        # Helper to check if string is valid Base64 that decodes to client_id:client_secret
        def try_extract_b64(val: str) -> Optional[str]:
            if not val or len(val) < 20:
                return None
            try:
                dec = base64.b64decode(val).decode("utf-8")
                if ":" in dec and len(dec.split(":")) == 2:
                    return val
            except Exception:
                pass
            return None

        # Build basic_auth with smart handling of Base64 or separate fields
        b64_found = try_extract_b64(sec) or try_extract_b64(key) or try_extract_b64(cid)
        if b64_found:
            basic_auth = b64_found
        elif cid and sec:
            if ":" in sec:
                basic_auth = base64.b64encode(sec.encode("utf-8")).decode("utf-8")
            else:
                auth_str = f"{cid}:{sec}"
                basic_auth = base64.b64encode(auth_str.encode("utf-8")).decode("utf-8")
        elif key:
            if ":" in key:
                basic_auth = base64.b64encode(key.encode("utf-8")).decode("utf-8")
            else:
                basic_auth = key
        elif sec and not cid:
            if ":" in sec:
                basic_auth = base64.b64encode(sec.encode("utf-8")).decode("utf-8")
            else:
                basic_auth = sec
        elif cid and not sec:
            raise ValueError("Указан Client ID, но не указан Client Secret (секрет клиента)")
        else:
            raise ValueError("Для подключения GigaChat укажите Client ID и Client Secret (или скопируйте Авторизационные данные в developers.sber.ru)")

        oauth_url = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth"
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Accept": "application/json",
            "RqUID": str(uuid.uuid4()),
            "Authorization": f"Basic {basic_auth}"
        }
        data = {"scope": sc}

        try:
            resp = requests.post(oauth_url, headers=headers, data=data, timeout=15, verify=False)
        except Exception as net_err:
            raise RuntimeError(f"Ошибка сетевого соединения со Сбером (ngw.devices.sberbank.ru:9443): {net_err}")

        if resp.status_code != 200:
            err_msg = resp.text
            try:
                err_json = resp.json()
                if "message" in err_json:
                    err_msg = err_json["message"]
                elif "description" in err_json:
                    err_msg = err_json["description"]
            except Exception:
                pass
            if resp.status_code == 401:
                raise RuntimeError(f"Ошибка авторизации GigaChat (HTTP 401): Неверный Client ID или Client Secret. Проверьте правильность скопированных данных из личного кабинета developers.sber.ru (Ответ сервера: {err_msg})")
            elif resp.status_code == 400:
                raise RuntimeError(f"Ошибка запроса GigaChat (HTTP 400): Проверьте тариф (Scope: {sc}). Ответ сервера: {err_msg}")
            else:
                raise RuntimeError(f"Ошибка авторизации GigaChat (HTTP {resp.status_code}): {err_msg}")

        res_data = resp.json()
        token = res_data.get("access_token")
        if not token:
            raise RuntimeError(f"Сервер GigaChat OAuth не вернул access_token: {resp.text}")

        expires_at_ms = res_data.get("expires_at", 0)
        self.gigachat_token = token
        self.gigachat_token_expires = (expires_at_ms / 1000.0) if expires_at_ms else (now + 1800)
        return token

    def test_openrouter(self, api_key: Optional[str] = None) -> Dict[str, Any]:
        """Test OpenRouter API key validity against /api/v1/auth/key endpoint."""
        key = (api_key or self.config.get("openrouter", {}).get("api_key", "")).strip()
        if not key:
            return {"success": False, "error": "API ключ OpenRouter не указан"}

        headers = {
            "Authorization": f"Bearer {key}",
            "HTTP-Referer": "http://127.0.0.1:8000",
            "X-Title": "SREDA AI"
        }
        try:
            resp = requests.get("https://openrouter.ai/api/v1/auth/key", headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                label = data.get("data", {}).get("label") or "Valid Key"
                usage = data.get("data", {}).get("usage") or 0
                limit = data.get("data", {}).get("limit") or "unlimited"
                return {
                    "success": True,
                    "message": f"✓ OpenRouter подключен успешно! ({label}, лимит: {limit})",
                    "data": data.get("data")
                }
            else:
                # Also fallback to testing models endpoint
                m_resp = requests.get("https://openrouter.ai/api/v1/models", headers=headers, timeout=10)
                if m_resp.status_code == 200:
                    return {"success": True, "message": "✓ OpenRouter API ключ активен!"}
                return {"success": False, "error": f"OpenRouter вернул ошибку {resp.status_code}: {resp.text[:200]}"}
        except Exception as e:
            return {"success": False, "error": f"Сетевая ошибка при проверке OpenRouter: {str(e)}"}

    def test_gigachat(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        auth_key: Optional[str] = None,
        scope: Optional[str] = None
    ) -> Dict[str, Any]:
        """Test Sber GigaChat OAuth authentication and model availability."""
        try:
            token = self.get_gigachat_token(
                client_id=client_id,
                client_secret=client_secret,
                auth_key=auth_key,
                scope=scope
            )
            headers = {
                "Authorization": f"Bearer {token}",
                "Accept": "application/json"
            }
            models = []
            try:
                resp = requests.get("https://api.giga.chat/v1/models", headers=headers, timeout=10, verify=False)
                if resp.status_code == 200:
                    m_data = resp.json()
                    models = [m.get("id") for m in m_data.get("data", [])]
            except Exception:
                pass

            return {
                "success": True,
                "message": "✓ Подключение к Сбер GigaChat API успешно! Токен получен (срок действия: 30 минут).",
                "models": models or ["GigaChat-2-Max", "GigaChat-2-Pro", "GigaChat-2", "GigaChat"]
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def test_custom(self, base_url: Optional[str] = None, api_key: Optional[str] = None, model: Optional[str] = None) -> Dict[str, Any]:
        """Test custom OpenAI-compatible endpoint."""
        url = (base_url or self.config.get("custom", {}).get("base_url", "")).strip().rstrip("/")
        key = (api_key or self.config.get("custom", {}).get("api_key", "")).strip()
        mod = (model or self.config.get("custom", {}).get("model", "")).strip()

        if not url:
            return {"success": False, "error": "Base URL не указан"}

        headers = {"Content-Type": "application/json"}
        if key:
            headers["Authorization"] = f"Bearer {key}"

        try:
            # 1. Try GET /models
            models_url = f"{url}/models"
            resp = requests.get(models_url, headers=headers, timeout=8)
            if resp.status_code == 200:
                return {"success": True, "message": f"✓ Сервер ответил успешно! ({resp.status_code} OK)"}

            # 2. Fallback: test chat completions with 1 token
            chat_url = f"{url}/chat/completions"
            payload = {
                "model": mod or "default",
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 1
            }
            c_resp = requests.post(chat_url, headers=headers, json=payload, timeout=10)
            if c_resp.status_code in [200, 400]:
                return {"success": True, "message": f"✓ Эндпоинт доступен ({c_resp.status_code})"}
            else:
                return {"success": False, "error": f"Ошибка ответа {c_resp.status_code}: {c_resp.text[:200]}"}
        except Exception as e:
            return {"success": False, "error": f"Ошибка соединения с сервером: {str(e)}"}

    def list_api_models(self) -> List[Dict[str, Any]]:
        """Return all active, enabled external API models for the UI model selector."""
        models: List[Dict[str, Any]] = []

        # 1. OpenRouter models
        or_cfg = self.config.get("openrouter", {})
        if or_cfg.get("enabled", False) and or_cfg.get("api_key"):
            active_m = or_cfg.get("model", "deepseek/deepseek-chat")
            added_ids = set()
            for m in or_cfg.get("available_models", []):
                mid = m["id"]
                is_selected = (mid == active_m)
                models.append({
                    "id": f"api:openrouter:{mid}",
                    "name": f"{m['name']} [OpenRouter]",
                    "model_id": mid,
                    "provider": "openrouter",
                    "provider_title": "OpenRouter API",
                    "type": "api",
                    "badge": "API / Облако",
                    "description": "Облачная модель OpenRouter. Работает без расхода VRAM.",
                    "is_active": is_selected
                })
                added_ids.add(mid)

            if active_m not in added_ids:
                models.insert(0, {
                    "id": f"api:openrouter:{active_m}",
                    "name": f"{active_m} [OpenRouter]",
                    "model_id": active_m,
                    "provider": "openrouter",
                    "provider_title": "OpenRouter API",
                    "type": "api",
                    "badge": "API / Облако",
                    "description": "Облачная модель OpenRouter.",
                    "is_active": True
                })

        # 2. GigaChat models
        gc_cfg = self.config.get("gigachat", {})
        has_gc_creds = bool((gc_cfg.get("client_id") and gc_cfg.get("client_secret")) or gc_cfg.get("auth_key"))
        if gc_cfg.get("enabled", False) and has_gc_creds:
            active_m = gc_cfg.get("model", "GigaChat-2-Max")
            added_ids = set()
            for m in gc_cfg.get("available_models", []):
                mid = m["id"]
                is_selected = (mid == active_m)
                models.append({
                    "id": f"api:gigachat:{mid}",
                    "name": f"{m['name']}",
                    "model_id": mid,
                    "provider": "gigachat",
                    "provider_title": "Сбер GigaChat API",
                    "type": "api",
                    "badge": "API / Облако",
                    "description": "Нейросеть Сбера. Работает через API без расхода VRAM.",
                    "is_active": is_selected
                })
                added_ids.add(mid)

            if active_m not in added_ids:
                models.insert(0, {
                    "id": f"api:gigachat:{active_m}",
                    "name": f"{active_m} [GigaChat]",
                    "model_id": active_m,
                    "provider": "gigachat",
                    "provider_title": "Сбер GigaChat API",
                    "type": "api",
                    "badge": "API / Облако",
                    "description": "Нейросеть Сбера GigaChat.",
                    "is_active": True
                })

        # 3. Custom OpenAI-compatible model
        cs_cfg = self.config.get("custom", {})
        if cs_cfg.get("enabled", False) and cs_cfg.get("base_url") and cs_cfg.get("model"):
            mid = cs_cfg.get("model")
            p_name = cs_cfg.get("name") or "Пользовательский API"
            models.append({
                "id": f"api:custom:{mid}",
                "name": f"{mid} [{p_name}]",
                "model_id": mid,
                "provider": "custom",
                "provider_title": p_name,
                "type": "api",
                "badge": "API / Облако",
                "description": f"Кастомный эндпоинт {cs_cfg.get('base_url')}.",
                "is_active": True
            })

        return models

    def stream_chat(
        self,
        provider: str,
        model_name: str,
        messages: List[Dict[str, Any]],
        temperature: float = 0.7,
        top_p: float = 0.95
    ) -> requests.Response:
        """Execute chat completions request against the selected cloud provider with SSE streaming."""
        prov = provider.lower().strip()

        if prov == "openrouter":
            or_cfg = self.config.get("openrouter", {})
            api_key = or_cfg.get("api_key", "").strip()
            if not api_key:
                raise ValueError("API-ключ OpenRouter не указан в Настройках")

            headers = {
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "http://127.0.0.1:8000",
                "X-Title": "SREDA AI",
                "Content-Type": "application/json"
            }
            payload = {
                "model": model_name,
                "messages": messages,
                "temperature": temperature,
                "top_p": top_p,
                "stream": True
            }
            return requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=payload,
                stream=True,
                timeout=60
            )

        elif prov == "gigachat":
            token = self.get_gigachat_token()
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
            payload = {
                "model": model_name,
                "messages": messages,
                "temperature": temperature,
                "top_p": top_p,
                "stream": True
            }
            try:
                res = requests.post(
                    "https://api.giga.chat/v1/chat/completions",
                    headers=headers,
                    json=payload,
                    stream=True,
                    timeout=60,
                    verify=False
                )
                if res.status_code == 404 or res.status_code >= 500:
                    res = requests.post(
                        "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
                        headers=headers,
                        json=payload,
                        stream=True,
                        timeout=60,
                        verify=False
                    )
                return res
            except Exception as e:
                raise RuntimeError(f"Сбой обращения к GigaChat API: {e}")

        elif prov == "custom":
            cs_cfg = self.config.get("custom", {})
            base_url = cs_cfg.get("base_url", "").strip().rstrip("/")
            api_key = cs_cfg.get("api_key", "").strip()
            if not base_url:
                raise ValueError("Base URL пользовательского API не указан")

            chat_url = f"{base_url}/chat/completions"
            headers = {"Content-Type": "application/json"}
            if api_key:
                headers["Authorization"] = f"Bearer {api_key}"

            payload = {
                "model": model_name,
                "messages": messages,
                "temperature": temperature,
                "top_p": top_p,
                "stream": True
            }
            return requests.post(
                chat_url,
                headers=headers,
                json=payload,
                stream=True,
                timeout=60
            )

        else:
            raise ValueError(f"Неизвестный провайдер API: '{provider}'")
