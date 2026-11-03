import os
import re
import json
import time
import hashlib
import subprocess
import urllib.request
from pathlib import Path
from typing import Optional, Dict, Any, List

class AudioService:
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.engine_dir = base_dir / "engine" / "audio"
        self.models_dir = base_dir / "models" / "audio"

        self.whisper_bin = self.engine_dir / "whisper" / "whisper-cli.exe"
        if not self.whisper_bin.exists():
            # Alternative name if packaged as main.exe
            alt = self.engine_dir / "whisper" / "main.exe"
            if alt.exists():
                self.whisper_bin = alt

        self.piper_bin = self.engine_dir / "piper" / "piper.exe"

        self.whisper_models_dir = self.models_dir / "whisper"
        self.piper_models_dir = self.models_dir / "piper"
        
        user_profile = os.environ.get("USERPROFILE", "C:\\Users\\Public")
        self.output_audio_dir = Path(user_profile) / "SredaAI" / "generated" / "audio"
        self.output_audio_dir.mkdir(parents=True, exist_ok=True)

        # Catalog of high-performance Piper voices for 9 supported languages (approx 35-60MB each)
        self.voice_catalog: Dict[str, Dict[str, Any]] = {
            "ru_dmitri": {
                "id": "ru_dmitri",
                "lang": "ru",
                "name": "Дмитрий (Русский)",
                "gender": "male",
                "quality": "medium",
                "size_mb": 60.3,
                "model_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/dmitri/medium/ru_RU-dmitri-medium.onnx",
                "config_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/dmitri/medium/ru_RU-dmitri-medium.onnx.json",
                "model_file": "ru/ru_RU-dmitri-medium.onnx",
                "config_file": "ru/ru_RU-dmitri-medium.onnx.json"
            },
            "ru_irina": {
                "id": "ru_irina",
                "lang": "ru",
                "name": "Ирина (Русский)",
                "gender": "female",
                "quality": "medium",
                "size_mb": 60.3,
                "model_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/irina/medium/ru_RU-irina-medium.onnx",
                "config_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/irina/medium/ru_RU-irina-medium.onnx.json",
                "model_file": "ru/ru_RU-irina-medium.onnx",
                "config_file": "ru/ru_RU-irina-medium.onnx.json"
            },
            "en_lessac": {
                "id": "en_lessac",
                "lang": "en",
                "name": "Lessac (English US)",
                "gender": "female",
                "quality": "medium",
                "size_mb": 60.3,
                "model_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx",
                "config_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json",
                "model_file": "en/en_US-lessac-medium.onnx",
                "config_file": "en/en_US-lessac-medium.onnx.json"
            },
            "de_thorsten": {
                "id": "de_thorsten",
                "lang": "de",
                "name": "Thorsten (Deutsch)",
                "gender": "male",
                "quality": "medium",
                "size_mb": 60.3,
                "model_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx",
                "config_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/medium/de_DE-thorsten-medium.onnx.json",
                "model_file": "de/de_DE-thorsten-medium.onnx",
                "config_file": "de/de_DE-thorsten-medium.onnx.json"
            },
            "fr_siwis": {
                "id": "fr_siwis",
                "lang": "fr",
                "name": "Siwis (Français)",
                "gender": "female",
                "quality": "medium",
                "size_mb": 60.3,
                "model_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx",
                "config_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/siwis/medium/fr_FR-siwis-medium.onnx.json",
                "model_file": "fr/fr_FR-siwis-medium.onnx",
                "config_file": "fr/fr_FR-siwis-medium.onnx.json"
            },
            "es_davefx": {
                "id": "es_davefx",
                "lang": "es",
                "name": "Davefx (Español)",
                "gender": "male",
                "quality": "medium",
                "size_mb": 60.3,
                "model_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx",
                "config_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx.json",
                "model_file": "es/es_ES-davefx-medium.onnx",
                "config_file": "es/es_ES-davefx-medium.onnx.json"
            },
            "pt_faber": {
                "id": "pt_faber",
                "lang": "pt",
                "name": "Faber (Português)",
                "gender": "male",
                "quality": "medium",
                "size_mb": 60.3,
                "model_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx",
                "config_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx.json",
                "model_file": "pt/pt_BR-faber-medium.onnx",
                "config_file": "pt/pt_BR-faber-medium.onnx.json"
            },
            "it_riccardo": {
                "id": "it_riccardo",
                "lang": "it",
                "name": "Riccardo (Italiano)",
                "gender": "male",
                "quality": "medium",
                "size_mb": 60.3,
                "model_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT/riccardo/medium/it_IT-riccardo-medium.onnx",
                "config_url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT/riccardo/medium/it_IT-riccardo-medium.onnx.json",
                "model_file": "it/it_IT-riccardo-medium.onnx",
                "config_file": "it/it_IT-riccardo-medium.onnx.json"
            }
        }

    # --- STT (WHISPER) ---
    def get_whisper_model(self) -> Path:
        # Prefer tiny model for budget builds, fallback to base if present
        tiny = self.whisper_models_dir / "ggml-tiny.bin"
        if tiny.exists():
            return tiny
        base = self.whisper_models_dir / "ggml-base.bin"
        if base.exists():
            return base
        return tiny

    def transcribe_audio(self, wav_path: Path, language: Optional[str] = None) -> Dict[str, Any]:
        """Transcribe 16kHz WAV file using whisper-cli.exe."""
        if not self.whisper_bin.exists():
            return {
                "success": False,
                "error": f"Движок распознавания речи не найден: {self.whisper_bin.name}"
            }

        model_path = self.get_whisper_model()
        if not model_path.exists():
            return {
                "success": False,
                "error": f"Модель Whisper не найдена: {model_path.name}"
            }

        whisper_dir = self.engine_dir / "whisper"
        try:
            rel_model = os.path.relpath(model_path, whisper_dir)
            rel_wav = os.path.relpath(wav_path, whisper_dir)
        except Exception:
            rel_model = str(model_path)
            rel_wav = str(wav_path)

        env = os.environ.copy()
        env["PATH"] = str(whisper_dir) + ";" + env.get("PATH", "")

        cmd = [
            "whisper-cli.exe",
            "-m", str(rel_model),
            "-f", str(rel_wav),
            "--no-timestamps",
            "-nt", "4"
        ]
        if language and language != "auto":
            cmd.extend(["-l", language])
        else:
            cmd.extend(["-l", "auto"])

        try:
            start_t = time.time()
            p = subprocess.Popen(
                cmd,
                executable=str(self.whisper_bin),
                cwd=str(whisper_dir),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            stdout_bytes, stderr_bytes = p.communicate(timeout=30)
            elapsed = round(time.time() - start_t, 2)
            
            output = stdout_bytes.decode("utf-8", errors="replace").strip()
            # Clean Whisper diagnostic logging if any
            clean_lines = []
            for line in output.splitlines():
                line_str = line.strip()
                if not line_str:
                    continue
                # Skip Whisper banner / timing lines / blank markers
                if line_str.startswith("whisper_") or line_str.startswith("main:") or "system_info:" in line_str or "[BLANK_AUDIO]" in line_str:
                    continue
                clean_lines.append(line_str)
            
            text = " ".join(clean_lines).strip()
            return {
                "success": True,
                "text": text,
                "elapsed_sec": elapsed,
                "model": model_path.name
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    # --- TTS (PIPER) ---
    def get_voice_for_lang(self, lang: str) -> Optional[Dict[str, Any]]:
        """Get best installed or default voice for a given language."""
        # 1. Look for installed voice for this language
        for vid, v in self.voice_catalog.items():
            if v["lang"] == lang and (self.piper_models_dir / v["model_file"]).exists():
                return v

        # 2. Look for any voice defined for this language
        for vid, v in self.voice_catalog.items():
            if v["lang"] == lang:
                return v

        # 3. Fallback to Russian Dmitri
        return self.voice_catalog.get("ru_dmitri")

    def is_voice_installed(self, voice_id: str) -> bool:
        v = self.voice_catalog.get(voice_id)
        if not v:
            return False
        model_p = self.piper_models_dir / v["model_file"]
        config_p = self.piper_models_dir / v["config_file"]
        return model_p.exists() and config_p.exists()

    def list_voices(self) -> List[Dict[str, Any]]:
        """List all voices with their installation status."""
        result = []
        for vid, v in self.voice_catalog.items():
            installed = self.is_voice_installed(vid)
            result.append({
                **v,
                "installed": installed
            })
        return result

    def download_voice(self, voice_id: str) -> Dict[str, Any]:
        """Download a Piper voice ONNX and JSON config on demand."""
        v = self.voice_catalog.get(voice_id)
        if not v:
            return {"success": False, "error": f"Голос {voice_id} не найден в каталоге"}

        model_dest = self.piper_models_dir / v["model_file"]
        config_dest = self.piper_models_dir / v["config_file"]

        model_dest.parent.mkdir(parents=True, exist_ok=True)

        try:
            headers = {"User-Agent": "SredaAI-VoiceDownload/5.0"}
            
            # Download model
            if not model_dest.exists() or model_dest.stat().st_size < 1000:
                req1 = urllib.request.Request(v["model_url"], headers=headers)
                with urllib.request.urlopen(req1, timeout=60) as resp, open(model_dest, "wb") as f:
                    f.write(resp.read())

            # Download JSON config
            if not config_dest.exists() or config_dest.stat().st_size < 10:
                req2 = urllib.request.Request(v["config_url"], headers=headers)
                with urllib.request.urlopen(req2, timeout=30) as resp, open(config_dest, "wb") as f:
                    f.write(resp.read())

            return {"success": True, "voice_id": voice_id}
        except Exception as e:
            return {"success": False, "error": f"Ошибка скачивания голоса: {e}"}

    def clean_text_for_speech(self, text: str) -> str:
        """Strip markdown, think tags, image generator tags, and code blocks."""
        # Strip reasoning
        text = re.sub(r'<think>[\s\S]*?</think>', '', text, flags=re.IGNORECASE)
        # Strip code blocks
        text = re.sub(r'```[\s\S]*?```', 'Код скрыт для озвучивания.', text)
        # Strip inline code
        text = re.sub(r'`[^`]*`', '', text)
        # Strip multimedia and tool tags
        text = re.sub(r'\[(?:TOOL_CALL|IMAGE_GEN|VIDEO_GEN|MUSIC_GEN|SOUND_GEN|MCP_CALL):[\s\S]*?\]', '', text, flags=re.IGNORECASE)
        text = re.sub(r'\[[A-Z_]+:\s*[^\]]+\]', '', text, flags=re.IGNORECASE)
        # Strip markdown symbols
        text = re.sub(r'[*_#~>]', '', text)
        # Clean multi spaces and newlines
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    def synthesize_speech(self, text: str, lang: str = "ru", voice_id: Optional[str] = None) -> Dict[str, Any]:
        """Synthesize text into WAV using piper.exe."""
        if not self.piper_bin.exists():
            return {"success": False, "error": "Движок Piper TTS не найден"}

        clean_text = self.clean_text_for_speech(text)
        if not clean_text:
            return {"success": False, "error": "Нет текста для озвучки"}

        # Determine voice
        voice_entry = None
        if voice_id and voice_id in self.voice_catalog:
            voice_entry = self.voice_catalog[voice_id]
        else:
            voice_entry = self.get_voice_for_lang(lang)

        if not voice_entry:
            return {"success": False, "error": f"Диктор для языка {lang} не найден"}

        if not self.is_voice_installed(voice_entry["id"]):
            return {
                "success": False,
                "code": "voice_missing",
                "voice": voice_entry,
                "message": f"Диктор {voice_entry['name']} не установлен"
            }

        model_path = self.piper_models_dir / voice_entry["model_file"]
        config_path = self.piper_models_dir / voice_entry["config_file"]

        # Cache by text hash
        text_hash = hashlib.md5(f"{clean_text}_{voice_entry['id']}".encode("utf-8")).hexdigest()
        out_filename = f"tts_{text_hash}.wav"
        out_file = self.output_audio_dir / out_filename

        if out_file.exists() and out_file.stat().st_size > 1000:
            return {
                "success": True,
                "audio_url": f"/api/audio/file/{out_filename}",
                "cached": True,
                "voice_name": voice_entry["name"]
            }

        piper_dir = self.engine_dir / "piper"
        try:
            rel_model = os.path.relpath(model_path, piper_dir)
            rel_config = os.path.relpath(config_path, piper_dir)
            rel_out = os.path.relpath(out_file, piper_dir)
        except Exception:
            rel_model = str(model_path)
            rel_config = str(config_path)
            rel_out = str(out_file)

        env = os.environ.copy()
        env["PATH"] = str(piper_dir) + ";" + env.get("PATH", "")

        # Run Piper process
        cmd = [
            "piper.exe",
            "--model", str(rel_model),
            "--config", str(rel_config),
            "--output_file", str(rel_out),
            "--espeak_data", "espeak-ng-data"
        ]

        try:
            p = subprocess.Popen(
                cmd,
                executable=str(self.piper_bin),
                cwd=str(piper_dir),
                env=env,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            stdout, stderr = p.communicate(input=clean_text.encode("utf-8"), timeout=25)
            
            if p.returncode != 0 or not out_file.exists():
                err = stderr.decode("utf-8", errors="replace")
                return {"success": False, "error": f"Ошибка синтеза Piper: {err}"}

            return {
                "success": True,
                "audio_url": f"/api/audio/file/{out_filename}",
                "cached": False,
                "voice_name": voice_entry["name"]
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
