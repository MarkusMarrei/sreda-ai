import os
import json
import time
import re
import threading
import requests
import uvicorn
from typing import Optional
from pathlib import Path
from fastapi import FastAPI, Request, BackgroundTasks, UploadFile, File, Form, Body
from fastapi.responses import StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .system_info import get_memory_info
from .llama_engine import LlamaEngine
from .hf_hub import HuggingFaceHub
from .multimedia_orchestrator import MultimediaOrchestrator
from .mcp_manager import MCPManager
from .audio_service import AudioService
from .vision_service import VisionService
from .rag_service import RagService
from .data_hub_service import DataHubService
from .boost_service import BoostService
from .provider_service import ProviderService

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="SREDA AI v9 - Multimodal Workstation")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def no_cache_middleware(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/static/") or request.url.path == "/":
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# Core subsystems
engine = LlamaEngine(BASE_DIR)
hf_hub = HuggingFaceHub(MODELS_DIR)
multimedia = MultimediaOrchestrator(BASE_DIR)
mcp_mgr = MCPManager()
audio_service = AudioService(BASE_DIR)
vision_service = VisionService(BASE_DIR)
rag_service = RagService(BASE_DIR)
rag_service.set_audio_service(audio_service)
data_hub = DataHubService(BASE_DIR)
boost_service = BoostService(BASE_DIR)
provider_service = ProviderService(BASE_DIR)

# Serve static generated assets before generic static frontend
app.mount("/static/generated", StaticFiles(directory=str(multimedia.output_base)), name="generated")
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

# Catalog of Bonsai 2 Family (100% Verified Hugging Face URLs)
BONSAI_CATALOG = [
    {
        "id": "bonsai-2-2b-ptq1",
        "name": "Bonsai 2 (2B) — PTQ1.0",
        "description": "Ультра-легкая тернарная модель Prism ML. Потребление ~400 МБ памяти, мгновенная генерация (60+ т/с).",
        "quantization": "PTQ1_0 (Ternary 1.58-bit)",
        "size_text": "0.40 ГБ",
        "size_bytes": 429496729,
        "speed": "~60 т/с",
        "filename": "Ternary-Bonsai-2-2B-PTQ1_0.gguf",
        "download_url": "https://huggingface.co/prism-ml/Ternary-Bonsai-2-2B-gguf/resolve/main/Ternary-Bonsai-2-2B-PTQ1_0.gguf",
        "recommended": True
    },
    {
        "id": "bonsai-2-4b-ptq1",
        "name": "Bonsai 2 (4B) — PTQ1.0",
        "description": "Оптимальная модель для встроенных видеоядер и слабых ПК. Отличное понимание русского языка при весе всего 0.88 ГБ.",
        "quantization": "PTQ1_0 (Ternary 1.58-bit)",
        "size_text": "0.88 ГБ",
        "size_bytes": 944892800,
        "speed": "~40 т/с",
        "filename": "Ternary-Bonsai-2-4B-PTQ1_0.gguf",
        "download_url": "https://huggingface.co/prism-ml/Ternary-Bonsai-2-4B-gguf/resolve/main/Ternary-Bonsai-2-4B-PTQ1_0.gguf",
        "recommended": True
    },
    {
        "id": "bonsai-2-9b-ptq1",
        "name": "Bonsai 2 (9B / 8B) — PTQ1.0",
        "description": "Идеальный стандарт для быстрых тестов, рассуждений и кода. Быстрый инференс и стабильная логика при весе 1.86 ГБ.",
        "quantization": "PTQ1_0 (Ternary 1.58-bit)",
        "size_text": "1.86 ГБ",
        "size_bytes": 1997152256,
        "speed": "~32 т/с",
        "filename": "Ternary-Bonsai-2-9B-PTQ1_0.gguf",
        "download_url": "https://huggingface.co/prism-ml/Ternary-Bonsai-2-9B-gguf/resolve/main/Ternary-Bonsai-2-9B-PTQ1_0.gguf",
        "recommended": True
    },
    {
        "id": "bonsai-1-8b-pq2",
        "name": "Bonsai (8B) — PQ2.0",
        "description": "Классическая модель Bonsai на архитектуре LLaMA-3 (8B) с 2-битным квантованием Prism ML.",
        "quantization": "PQ2_0 (2-bit High Precision)",
        "size_text": "2.03 ГБ",
        "size_bytes": 2179973120,
        "speed": "~28 т/с",
        "filename": "Ternary-Bonsai-8B-PQ2_0.gguf",
        "download_url": "https://huggingface.co/prism-ml/Ternary-Bonsai-8B-gguf/resolve/main/Ternary-Bonsai-8B-PQ2_0.gguf",
        "recommended": False
    },
    {
        "id": "bonsai-2-27b-ptq1",
        "name": "Bonsai 2 (27B) — PTQ1.0",
        "description": "Флагманская тернарная модель Prism ML. Уровень рассуждений 27B при весе 5.54 ГБ. Полный оффлоад в Radeon 780M через Vulkan.",
        "quantization": "PTQ1_0 (Ternary 1.58-bit)",
        "size_text": "5.54 ГБ",
        "size_bytes": 5946648928,
        "speed": "~12 т/с",
        "filename": "Ternary-Bonsai-2-27B-PTQ1_0.gguf",
        "download_url": "https://huggingface.co/prism-ml/Ternary-Bonsai-2-27B-gguf/resolve/main/Ternary-Bonsai-2-27B-PTQ1_0.gguf",
        "recommended": True
    },
    {
        "id": "bonsai-2-27b-pq2",
        "name": "Bonsai 2 (27B) — PQ2.0",
        "description": "Повышенная точность 2-битного квантования Prism ML. Требует чуть больше памяти (6.71 ГБ), максимальное сохранение тонких деталей.",
        "quantization": "PQ2_0 (2-bit High Precision)",
        "size_text": "6.71 ГБ",
        "size_bytes": 7204962304,
        "speed": "~9 т/с",
        "filename": "Ternary-Bonsai-2-27B-PQ2_0.gguf",
        "download_url": "https://huggingface.co/prism-ml/Ternary-Bonsai-2-27B-gguf/resolve/main/Ternary-Bonsai-2-27B-PQ2_0.gguf",
        "recommended": False
    }
]

@app.get("/")
def index():
    return FileResponse(
        FRONTEND_DIR / "index.html",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0"}
    )

@app.get("/favicon.ico")
def get_favicon():
    ico_path = FRONTEND_DIR / "favicon.ico"
    if ico_path.exists():
        return FileResponse(
            ico_path,
            media_type="image/x-icon",
            headers={"Cache-Control": "public, max-age=86400"}
        )
    return FileResponse(
        FRONTEND_DIR / "assets" / "icons" / "icon-32.png",
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=86400"}
    )

@app.get("/manifest.json")
def get_manifest():
    return FileResponse(
        FRONTEND_DIR / "manifest.json",
        media_type="application/json",
        headers={"Cache-Control": "public, max-age=86400"}
    )

@app.get("/api/system")
def api_system():
    return get_memory_info()

@app.get("/api/models/local")
def api_local_models():
    return engine.list_local_models()

@app.post("/api/models/open_folder")
def api_open_models_folder():
    try:
        MODELS_DIR.mkdir(parents=True, exist_ok=True)
        os.startfile(str(MODELS_DIR))
        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

class ModelDeleteReq(BaseModel):
    model_path: str

@app.post("/api/models/delete")
def api_delete_model(req: ModelDeleteReq):
    try:
        target = Path(req.model_path).resolve()
        if not target.exists():
            return {"success": False, "error": f"Файл модели не найден: {target.name}"}
        
        # Stop engine if the model to delete is currently running in llama-server
        if engine.is_alive() and engine.current_model_path:
            curr_target = Path(engine.current_model_path).resolve()
            if curr_target == target:
                engine.stop()
                time.sleep(0.5)

        target.unlink()
        return {"success": True, "deleted_model": target.name}
    except Exception as e:
        return {"success": False, "error": f"Ошибка удаления модели: {e}"}

@app.get("/api/models/bonsai")
def api_bonsai_catalog():
    local_files = {f["name"].lower(): f["path"] for f in engine.list_local_models()}
    catalog = []
    for item in BONSAI_CATALOG:
        fn = item["filename"].lower()
        is_dl = fn in local_files
        local_path = local_files.get(fn, "")
        catalog.append({
            **item,
            "is_downloaded": is_dl,
            "local_path": local_path,
            "is_active": engine.current_model_path.lower().endswith(fn) if engine.is_alive() else False
        })
    return catalog

@app.get("/api/models/hf/search")
def api_hf_search(q: str = "gguf"):
    return hf_hub.search_models(q)

@app.get("/api/models/hf/repo_files")
def api_hf_repo_files(repo_id: str):
    mem = get_memory_info()
    return hf_hub.get_repo_files(repo_id, available_ram_gb=mem["available_ram_gb"])

class DownloadReq(BaseModel):
    url: str
    filename: str

@app.post("/api/models/hf/download")
def api_hf_download(req: DownloadReq):
    ok = hf_hub.start_download(req.url, req.filename)
    return {"success": ok}

@app.get("/api/models/hf/download_progress")
def api_hf_progress():
    return hf_hub.download_progress

@app.post("/api/models/hf/cancel_download")
def api_hf_cancel():
    hf_hub.cancel_download()
    return {"success": True}

class StartEngineReq(BaseModel):
    model_path: str
    gpu_layers: int = 99
    threads: int = 8
    context: int = 8192
    flash_attention: bool = True

@app.post("/api/engine/start")
def api_start_engine(req: StartEngineReq):
    ok = engine.start(
        model_path=req.model_path,
        gpu_layers=req.gpu_layers,
        threads=req.threads,
        context=req.context,
        flash_attention=req.flash_attention
    )
    boost_info = None
    if ok and (boost_service.is_boost_active or boost_service.config.get("auto_boost_on_launch", True)):
        engine_pid = engine.process.pid if engine.process else None
        boost_info = boost_service.activate_boost(engine_pid)

    return {
        "success": ok,
        "status": engine.status,
        "message": engine.status_message,
        "active_model": engine.current_model_path,
        "boost": boost_info
    }

@app.post("/api/engine/stop")
def api_stop_engine():
    engine.stop()
    boost_service.deactivate_boost()
    return {"status": engine.status, "message": engine.status_message}

@app.get("/api/engine/status")
def api_engine_status():
    return {
        "status": engine.status,
        "message": engine.status_message,
        "is_alive": engine.is_alive(),
        "active_model": engine.current_model_path
    }

class ChatReq(BaseModel):
    messages: list
    model_path: str = ""
    temperature: float = 0.7
    top_p: float = 0.9
    user_profile: dict = None
    skill_prompt: str = ""
    language: str = "ru"

@app.post("/api/chat/stream")
async def api_chat_stream(req: ChatReq):
    is_api_model = bool(req.model_path and req.model_path.startswith("api:"))

    # Local models require engine verification; API models bypass local llama-server
    if not is_api_model and not engine.is_alive():
        # If currently starting in another thread/request, wait for it
        if engine.status == "starting":
            wait_s = time.time()
            while time.time() - wait_s < 35:
                if engine.is_alive():
                    break
                time.sleep(0.5)

        if not engine.is_alive():
            target_model = req.model_path
            if not target_model:
                locals_list = engine.list_local_models()
                if locals_list:
                    target_model = locals_list[0]["path"]
            if target_model:
                ok = engine.start(model_path=target_model)
                if not ok or not engine.is_alive():
                    def err_gen():
                        msg = f"Не удалось запустить модель: {engine.status_message}"
                        yield f"data: {json.dumps({'type': 'error', 'message': msg}, ensure_ascii=False)}\n\n".encode("utf-8")
                    return StreamingResponse(
                        err_gen(),
                        media_type="text/event-stream; charset=utf-8",
                        headers={"Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache"}
                    )
            else:
                def err_gen():
                    yield f"data: {json.dumps({'type': 'error', 'message': 'Файл модели не найден на диске. Выберите модель в Каталоге.'}, ensure_ascii=False)}\n\n".encode("utf-8")
                return StreamingResponse(
                    err_gen(),
                    media_type="text/event-stream; charset=utf-8",
                    headers={"Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache"}
                )

    # Multi-language localization system directive
    LANG_DIRECTIVES = {
        "ru": "Всегда отвечай пользователю структурированно, грамотно и исключительно на чистом русском языке.",
        "en": "Always respond to the user in a well-structured, precise, and fluent English.",
        "de": "Antworte dem Benutzer immer strukturiert, präzise und in fließendem Deutsch.",
        "fr": "Réponds toujours à l'utilisateur de manière structurée, précise et en français courant.",
        "es": "Responde siempre al usuario de manera estructurada, precisa y en español fluido.",
        "pt": "Responda sempre ao usuário de forma estruturada, precisa e em português fluente.",
        "it": "Rispondi sempre all'utente in modo strutturato, preciso e in un italiano fluente.",
        "ja": "常に論理的で明確、かつ自然な日本語で回答してください。",
        "ko": "항상 논리적이고 명확하며 유창한 한국어로 답변하십시오."
    }
    lang_inst = LANG_DIRECTIVES.get(req.language, LANG_DIRECTIVES["ru"])

    # Personalization from User Profile
    personalization = ""
    if req.user_profile:
        first = req.user_profile.get("firstName", "").strip()
        last = req.user_profile.get("lastName", "").strip()
        name = f"{first} {last}".strip()
        about = req.user_profile.get("about", "").strip()
        if name:
            personalization += f"\n[ПОЛЬЗОВАТЕЛЬ]: Собеседника зовут {name}."
        if about:
            personalization += f" Информация о пользователе: {about}."
        if personalization:
            personalization += " Учитывай эту информацию для персонализированного общения."

    # Skill Directive (if any)
    skill_directive = ""
    if req.skill_prompt:
        skill_directive = f"\n\n[АКТИВНЫЙ СКИЛЛ / СПЕЦИАЛИЗАЦИЯ]:\n{req.skill_prompt.strip()}"

    # Inject system instructions for multimedia tool routing and MCP calls
    system_prompt_add = (
        f"\n\n[ЯЗЫКОВАЯ ДИРЕКТИВА]: {lang_inst}\n" +
        personalization +
        skill_directive +
        "\n\n[МЕНЕДЖЕР МУЛЬТИМЕДИА, LIVE-ДАННЫХ И ВЫЗОВ ИНСТРУМЕНТОВ]:\n"
        "Ты обладаешь возможностью генерировать изображения, нейросетевую музыку и звуковые эффекты, а также получать АКТУАЛЬНЫЕ LIVE-ДАННЫЕ В РЕАЛЬНОМ ВРЕМЕНИ через встроенные инструментные теги:\n"
        "1. Для генерации ИЗОБРАЖЕНИЙ (Stable Diffusion): [TOOL_CALL: generate_image(prompt=\"...подробный промпт на английском...\")] или [IMAGE_GEN: prompt=\"...\"]\n"
        "2. Для генерации МУЗЫКИ и МЕЛОДИЙ (MusicGen Small: гитара, скрипка, пианино, оркестр, саундтреки): [TOOL_CALL: generate_music(prompt=\"...детальное музыкальное описание на английском, жанр, инструменты...\", duration=5)]\n"
        "3. Для генерации ЗВУКОВЫХ ЭФФЕКТОВ и ФОНА (AudioLDM Neural Diffusion: мяуканье кошки, лай собаки, топот, дождь, шумы): [TOOL_CALL: generate_sound(prompt=\"...описание звука...\", duration=3)]\n"
        "4. Для получения АКТУАЛЬНЫХ LIVE-ДАННЫХ (Криптовалюты, Акции, Металлы, Валюты, Погода, Страны):\n"
        "   - [TOOL_CALL: fetch_data(source=\"crypto\", query=\"bitcoin\")] (или ethereum, sol, ton)\n"
        "   - [TOOL_CALL: fetch_data(source=\"stocks\", query=\"AAPL\")] (или TSLA, NVDA, золото, нефть, SP500, Мосбиржа)\n"
        "   - [TOOL_CALL: fetch_data(source=\"rates\", query=\"USD\")] (или EUR, RUB, CNY)\n"
        "   - [TOOL_CALL: fetch_data(source=\"weather\", query=\"Москва\")] (или Санкт-Петербург, Сочи, Лондон, Дубай)\n"
        "   - [TOOL_CALL: fetch_data(source=\"country\", query=\"Япония\")] (или Россия, Германия, Бразилия)\n"
        "5. Для получения НОВОСТЕЙ И МИРОВЫХ ТРЕНДОВ:\n"
        "   - [TOOL_CALL: fetch_news(source=\"hackernews\")]\n"
        "   - [TOOL_CALL: fetch_news(source=\"gdelt\", query=\"AI\")]\n"
        "   - [TOOL_CALL: fetch_rss(url=\"https://habr.com/ru/rss/best/daily/?fl=ru\")]\n\n"
        "ПРАВИЛА РОУТИНГА:\n"
        "- Если запрос касается МУЗЫКИ или мелодий — вызывай generate_music!\n"
        "- Если запрос касается ЗВУКОВ животных или фоновых спецэффектов — вызывай generate_sound!\n"
        "- Если пользователь спрашивает свежие котировки, курсы, погоду или новости — вызывай соответствующий fetch_data / fetch_news / fetch_rss!\n"
        "- Всегда помещай тег вызова инструмента [TOOL_CALL: ...] в самом конце ответа с новой строки. Основной текст пиши живым, полезным и естественным языком, так как теги скрываются от пользователя и не читаются вслух.\n\n"
        "[ПРОТОКОЛ MCP & BLENDER 3D]: Если пользователь просит подключиться к Blender или выполнить действие в 3D через MCP:\n"
        "- [MCP_CALL: server=\"blender\", port=9876, tool=\"blender_execute_script\", args={\"code\": \"...код bpy...\"}]\n"
        "- [MCP_CALL: server=\"blender\", port=9876, tool=\"blender_object_create\", args={\"type\": \"cube\", \"name\": \"Cube\", \"location\": [0,0,0]}]"
    )
    # Dynamically inject active user custom APIs
    custom_apis = data_hub.config.get("custom_apis", [])
    active_custom = [c for c in custom_apis if c.get("enabled", True)]
    if active_custom:
        system_prompt_add += "\n\n[ПОЛЬЗОВАТЕЛЬСКИЕ API]:\n"
        for c in active_custom:
            system_prompt_add += f"- [TOOL_CALL: fetch_data(source=\"{c.get('id')}\", query=\"...\")] : {c.get('name')} — {c.get('description', '')}\n"

    formatted_messages = []
    has_system = False
    for m in req.messages:
        if m["role"] == "system":
            formatted_messages.append({"role": "system", "content": m["content"] + system_prompt_add})
            has_system = True
        else:
            formatted_messages.append(m)

    if not has_system:
        formatted_messages.insert(0, {
            "role": "system",
            "content": f"Ты — автономная мультимодальная рабочая станция и персональный интеллектуальный ассистент SREDA AI. Всегда представляйся исключительно как SREDA AI. Никогда не упоминай названия базовых архитектур или моделей (Bonsai, LLaMA, Gemma и др.), если пользователь прямо не спросит о техническом квантовании. {lang_inst}" + system_prompt_add
        })

    def generate_events():
        start_time = time.time()
        token_count = 0
        in_think = False
        accumulated_text = ""

        try:
            res = None
            if is_api_model:
                # Format: api:<provider>:<model_name>
                parts = req.model_path.split(":", 2)
                prov = parts[1] if len(parts) > 1 else "openrouter"
                mod_name = parts[2] if len(parts) > 2 else "deepseek/deepseek-chat"
                try:
                    res = provider_service.stream_chat(
                        provider=prov,
                        model_name=mod_name,
                        messages=formatted_messages,
                        temperature=req.temperature,
                        top_p=req.top_p
                    )
                except Exception as e:
                    yield f"data: {json.dumps({'type': 'error', 'message': f'Ошибка подключения к {prov.upper()} API: {e}'}, ensure_ascii=False)}\n\n".encode("utf-8")
                    return
            else:
                # Local llama-server
                for attempt in range(5):
                    try:
                        res = requests.post(
                            f"{engine.base_url}/v1/chat/completions",
                            json={
                                "model": "sreda-bonsai",
                                "messages": formatted_messages,
                                "temperature": req.temperature,
                                "top_p": req.top_p,
                                "stream": True,
                            },
                            stream=True,
                            timeout=60
                        )
                        if res.status_code == 200:
                            break
                    except (requests.exceptions.ConnectionError, requests.exceptions.Timeout):
                        if attempt < 4 and engine.is_alive():
                            time.sleep(1.0)
                        else:
                            raise

            if not res or res.status_code != 200:
                if res is not None:
                    try:
                        err_json = res.json()
                        err_text = err_json.get("message") or err_json.get("description") or res.text
                    except Exception:
                        err_text = res.text or f"HTTP {res.status_code}"
                else:
                    err_text = "Сервер инференса недоступен (локальный движок не запущен)"
                yield f"data: {json.dumps({'type': 'error', 'message': f'Ошибка ответа API/движка: {err_text}'}, ensure_ascii=False)}\n\n".encode("utf-8")
                return

            # Ensure UTF-8 decoding to prevent Cyrillic mojibake (ISO-8859-1 pitfall)
            res.encoding = "utf-8"

            for raw_line in res.iter_lines(decode_unicode=False):
                if not raw_line:
                    continue
                try:
                    line = raw_line.decode("utf-8")
                except UnicodeDecodeError:
                    line = raw_line.decode("utf-8", errors="replace")

                if line.startswith("data: "):
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        parsed = json.loads(data_str)
                        choices = parsed.get("choices", [])
                        if choices:
                            delta = choices[0].get("delta", {})
                            content = delta.get("content") or ""
                            reasoning = delta.get("reasoning_content") or ""
                            finish_reason = choices[0].get("finish_reason")

                            if reasoning:
                                yield f"data: {json.dumps({'type': 'reasoning', 'content': reasoning}, ensure_ascii=False)}\n\n".encode("utf-8")

                            if content:
                                # Strip reasoning/think tags
                                if "<think>" in content:
                                    in_think = True
                                    content = content.split("<think>")[0]
                                elif "</think>" in content:
                                    in_think = False
                                    content = content.split("</think>")[-1]
                                elif in_think:
                                    continue

                                if content:
                                    accumulated_text += content
                                    token_count += 1
                                    event_payload = json.dumps({"type": "token", "content": content}, ensure_ascii=False)
                                    yield f"data: {event_payload}\n\n".encode("utf-8")

                            if finish_reason and finish_reason != "null":
                                break
                    except Exception:
                        pass

            elapsed = max(0.001, time.time() - start_time)
            speed = round(token_count / elapsed, 1)

            # Check for multimedia tool calls and MCP tool calls in the output
            tools = multimedia.parse_tools_from_text(accumulated_text)
            mcp_calls = mcp_mgr.parse_mcp_calls_from_text(accumulated_text)

            done_payload = json.dumps({
                "type": "done",
                "tokens": token_count,
                "speed": speed,
                "tools": tools,
                "mcp_calls": mcp_calls
            }, ensure_ascii=False)
            yield f"data: {done_payload}\n\n".encode("utf-8")
        except Exception as e:
            err_payload = json.dumps({"type": "error", "message": str(e)}, ensure_ascii=False)
            yield f"data: {err_payload}\n\n".encode("utf-8")

    return StreamingResponse(
        generate_events(),
        media_type="text/event-stream; charset=utf-8",
        headers={
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

class SpeakReq(BaseModel):
    text: str

@app.post("/api/tts/speak")
def api_tts_speak(req: SpeakReq):
    ok = multimedia.speak_text(req.text)
    return {"success": ok}

# --- AUDIO SUBSYSTEM (STT / TTS) ---
class TTSReq(BaseModel):
    text: str
    lang: str = "ru"
    voice_id: Optional[str] = None

@app.post("/api/audio/tts")
def api_audio_tts(req: TTSReq):
    return audio_service.synthesize_speech(text=req.text, lang=req.lang, voice_id=req.voice_id)

@app.get("/api/audio/file/{filename}")
def api_audio_file(filename: str):
    file_path = audio_service.output_audio_dir / filename
    if not file_path.exists():
        return JSONResponse({"error": "Audio file not found"}, status_code=404)
    return FileResponse(
        path=str(file_path),
        media_type="audio/wav",
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=3600"
        }
    )

@app.post("/api/audio/transcribe")
async def api_audio_transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form("auto")
):
    try:
        temp_dir = audio_service.output_audio_dir / "temp"
        temp_dir.mkdir(parents=True, exist_ok=True)
        temp_path = temp_dir / f"stt_input_{int(time.time()*1000)}.wav"
        
        contents = await file.read()
        with open(temp_path, "wb") as f:
            f.write(contents)
            
        result = audio_service.transcribe_audio(temp_path, language=language)
        
        # Clean up temp file
        try:
            if temp_path.exists():
                temp_path.unlink()
        except Exception:
            pass
            
        return result
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/audio/voices")
def api_audio_voices():
    return {"voices": audio_service.list_voices()}

class VoiceDownloadReq(BaseModel):
    voice_id: str

@app.post("/api/audio/voices/download")
def api_audio_voice_download(req: VoiceDownloadReq):
    return audio_service.download_voice(req.voice_id)

class MediaGenReq(BaseModel):
    type: str
    prompt: str
    duration: int = 5
    steps: int = 2

@app.post("/api/media/generate")
def api_media_generate(req: MediaGenReq):
    t = req.type.lower()
    if t in ["image", "generate_image"]:
        res = multimedia.generate_image(req.prompt, steps=req.steps)
        if "url" in res:
            res["file_url"] = res["url"]
        return res
    elif t in ["sound", "generate_sound"]:
        res = multimedia.generate_sound(req.prompt, duration=req.duration)
        if "url" in res:
            res["file_url"] = res["url"]
        return res
    elif t in ["music", "generate_music"]:
        res = multimedia.generate_music(req.prompt, duration=req.duration)
        if "url" in res:
            res["file_url"] = res["url"]
        return res
    return {"success": False, "error": f"Тип {req.type} пока не поддерживается"}

@app.post("/api/multimedia/upload_image")
async def api_upload_image(file: UploadFile = File(...)):
    uploads_dir = multimedia.output_base / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    ts = int(time.time() * 1000)
    safe_name = re.sub(r'[^a-zA-Z0-9_.-]', '_', file.filename or 'upload.bin')
    target_path = uploads_dir / f"file_{ts}_{safe_name}"

    contents = await file.read()
    with open(target_path, "wb") as f:
        f.write(contents)

    ext = target_path.suffix.lower()
    is_image = ext in ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.gif']

    if is_image:
        analysis = vision_service.analyze_image(target_path)
        vision_context = vision_service.format_vision_context_for_prompt(analysis)
        doc_category = "image"
    else:
        # Document (Word, PDF, Text, Markdown)
        doc_res = rag_service.process_file(target_path)
        vision_context = rag_service.format_document_context_for_prompt(doc_res)
        analysis = doc_res
        doc_category = doc_res.get("doc_category", "document")

    return {
        "success": True,
        "type": "image" if is_image else "document",
        "doc_category": doc_category,
        "url": f"/static/generated/uploads/{target_path.name}",
        "file_url": f"/static/generated/uploads/{target_path.name}",
        "file_path": str(target_path),
        "filename": file.filename,
        "analysis": analysis,
        "vision_context": vision_context
    }

# --- MCP (MODEL CONTEXT PROTOCOL) ENDPOINTS ---
class MCPConnectReq(BaseModel):
    url: str = "http://127.0.0.1:9876"

@app.post("/api/mcp/connect")
def api_mcp_connect(req: MCPConnectReq):
    return mcp_mgr.test_connection(req.url)

class MCPCallReq(BaseModel):
    server_url: str = "http://127.0.0.1:9876"
    tool_name: str
    arguments: dict = {}

@app.post("/api/mcp/call")
def api_mcp_call(req: MCPCallReq):
    return mcp_mgr.call_tool(req.server_url, req.tool_name, req.arguments)

@app.get("/api/mcp/blender_tools")
def api_mcp_blender_tools():
    return mcp_mgr.get_known_blender_tools()

# --- OPENAI-COMPATIBLE SERVER (LM STUDIO STYLE) ---
@app.get("/v1/models")
def openai_models():
    active = Path(engine.current_model_path).name if engine.current_model_path else "Ternary-Bonsai-2-27B-PTQ1_0.gguf"
    model_list = [
        {"id": "sreda-ai", "object": "model", "created": int(time.time()), "owned_by": "sreda-ai"},
        {"id": "default", "object": "model", "created": int(time.time()), "owned_by": "sreda-ai"},
        {"id": active, "object": "model", "created": int(time.time()), "owned_by": "sreda-ai"}
    ]
    for m in engine.list_local_models():
        fn = m["name"]
        if fn != active:
            model_list.append({"id": fn, "object": "model", "created": int(time.time()), "owned_by": "local"})
    return {"object": "list", "data": model_list}

@app.post("/v1/chat/completions")
async def openai_completions(request: Request):
    body = await request.json()
    if not engine.is_alive():
        locals_list = engine.list_local_models()
        if locals_list:
            engine.start(model_path=locals_list[0]["path"])

    try:
        resp = requests.post(
            f"{engine.base_url}/v1/chat/completions",
            json=body,
            stream=body.get("stream", False),
            timeout=300
        )
        if body.get("stream", False):
            return StreamingResponse(
                resp.iter_content(chunk_size=512),
                media_type="text/event-stream; charset=utf-8",
                headers={"Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache"}
            )
        return JSONResponse(resp.json(), status_code=resp.status_code)
    except Exception as e:
        return JSONResponse({"error": {"message": f"Ошибка связи с движком: {e}", "type": "engine_error"}}, status_code=504)

@app.post("/v1/completions")
async def openai_completions_legacy(request: Request):
    body = await request.json()
    if not engine.is_alive():
        locals_list = engine.list_local_models()
        if locals_list:
            engine.start(model_path=locals_list[0]["path"])

    try:
        resp = requests.post(
            f"{engine.base_url}/v1/completions",
            json=body,
            stream=body.get("stream", False),
            timeout=300
        )
        if body.get("stream", False):
            return StreamingResponse(
                resp.iter_content(chunk_size=512),
                media_type="text/event-stream; charset=utf-8",
                headers={"Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache"}
            )
        return JSONResponse(resp.json(), status_code=resp.status_code)
    except Exception as e:
        return JSONResponse({"error": {"message": f"Ошибка связи с движком: {e}", "type": "engine_error"}}, status_code=504)


# --- DATA HUB & LIVE RSS / API ENDPOINTS ---
class FeedTestReq(BaseModel):
    source: str
    query: Optional[str] = ""
    api_config: Optional[dict] = None

class FeedQueryReq(BaseModel):
    source: str
    query: Optional[str] = ""
    limit: Optional[int] = None

@app.get("/api/feeds/config")
def api_feeds_config():
    return data_hub.config

@app.post("/api/feeds/config")
def api_feeds_save_config(config: dict):
    ok = data_hub.save_config(config)
    return {"success": ok, "config": data_hub.config}

@app.post("/api/feeds/test")
def api_feeds_test(req: FeedTestReq):
    t0 = time.time()
    if req.source == "custom" and req.api_config:
        res = data_hub.fetch_custom_api(req.api_config, req.query or "")
    else:
        res = data_hub.fetch_live_data(req.source, req.query or "")
    latency_ms = round((time.time() - t0) * 1000, 1)
    res["latency_ms"] = latency_ms
    return res

@app.post("/api/feeds/query")
def api_feeds_query(req: FeedQueryReq):
    return data_hub.fetch_live_data(req.source, req.query or "", req.limit)

# --- SREDA BOOST & RESOURCE OPTIMIZATION ENDPOINTS ---
@app.get("/api/boost/status")
def api_boost_status():
    return boost_service.get_status()

@app.post("/api/boost/activate")
def api_boost_activate():
    engine_pid = engine.process.pid if (engine and engine.process) else None
    return boost_service.activate_boost(engine_pid)

@app.post("/api/boost/deactivate")
def api_boost_deactivate():
    return boost_service.deactivate_boost()

@app.post("/api/boost/compact-ram")
def api_boost_compact_ram():
    return boost_service.compact_ram()

@app.post("/api/boost/config")
def api_boost_save_config(config: dict):
    ok = boost_service.save_config(config)
    return {"success": ok, "config": boost_service.config}

# --- API PROVIDERS & EXTERNAL CLOUD MODELS ---
@app.get("/api/providers/config")
def api_providers_get_config():
    return provider_service.config

@app.post("/api/providers/config")
def api_providers_save_config(config: dict = Body(...)):
    ok = provider_service.save_config(config)
    return {"success": ok, "config": provider_service.config}

@app.get("/api/providers/models")
def api_providers_get_models():
    return provider_service.list_api_models()

@app.post("/api/providers/test/openrouter")
def api_providers_test_openrouter(data: dict = Body(default={})):
    return provider_service.test_openrouter(api_key=data.get("api_key"))

@app.post("/api/providers/test/gigachat")
def api_providers_test_gigachat(data: dict = Body(default={})):
    return provider_service.test_gigachat(
        client_id=data.get("client_id"),
        client_secret=data.get("client_secret"),
        auth_key=data.get("auth_key"),
        scope=data.get("scope")
    )

@app.post("/api/providers/test/custom")
def api_providers_test_custom(data: dict = Body(default={})):
    return provider_service.test_custom(
        base_url=data.get("base_url"),
        api_key=data.get("api_key"),
        model=data.get("model")
    )

@app.get("/api/models/all")
def api_all_models():
    locals_list = engine.list_local_models()
    result = []
    for m in locals_list:
        result.append({
            "id": m["path"],
            "name": m["name"],
            "path": m["path"],
            "is_api": False,
            "badge": "Локальная",
            "size_gb": m.get("size_gb", 0),
            "is_active": engine.current_model_path == m["path"] if engine.is_alive() else False
        })
    api_models = provider_service.list_api_models()
    result.extend(api_models)
    return result

def start_lm_studio_server(port: int = 1234):
    """Run background LM Studio compatibility server on port 1234."""
    def _run():
        try:
            uvicorn.run(app, host="127.0.0.1", port=port, log_level="error")
        except Exception as e:
            print(f"[*] Примечание по порту API {port}: {e}")

    t = threading.Thread(target=_run, daemon=True, name="LMStudioServerThread")
    t.start()

# Launch background listener on port 1234
start_lm_studio_server(1234)
