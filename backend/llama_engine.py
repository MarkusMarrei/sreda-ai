import os
import sys
import time
import threading
import subprocess
import requests
from pathlib import Path

class LlamaEngine:
    def __init__(self, base_dir: Path):
        self.base_dir = base_dir
        self.engine_dir = base_dir / "engine"
        self.server_exe = self.engine_dir / "llama-server.exe"
        self.process = None
        self.current_model_path = ""
        self.status = "idle" # idle, starting, ready, generating, error
        self.status_message = "Движок не запущен"
        self.port = 8080
        self.base_url = f"http://127.0.0.1:{self.port}"
        self._lock = threading.Lock()
        self._log_file = self.engine_dir / "llama_server.log"

    def get_models_dirs(self):
        user_profile = os.environ.get("USERPROFILE", "")
        app_data = os.environ.get("APPDATA", "")
        dirs = [
            self.base_dir / "models",
            Path(user_profile) / "SredaAI" / "models",
            Path(app_data) / "SredaAI" / "models",
            Path(user_profile) / "Downloads",
        ]
        return [d for d in dirs if d.exists()]

    def list_local_models(self):
        models = {}
        for d in self.get_models_dirs():
            try:
                for f in d.glob("*.gguf"):
                    name = f.name.lower()
                    if name not in models:
                        size_mb = f.stat().st_size / (1024 * 1024)
                        size_text = f"{size_mb / 1024:.2f} ГБ" if size_mb >= 1024 else f"{size_mb:.0f} МБ"
                        models[name] = {
                            "name": f.name,
                            "path": str(f.resolve()),
                            "size_bytes": f.stat().st_size,
                            "size_gb": round(f.stat().st_size / (1024 ** 3), 2),
                            "size_text": size_text,
                            "modified": f.stat().st_mtime,
                        }
            except Exception:
                pass
        return list(models.values())

    def start(self, model_path: str, gpu_layers: int = 99, threads: int = 8, context: int = 8192, flash_attention: bool = True):
        with self._lock:
            # If already alive with this exact model, reuse existing instance
            if self.is_alive() and self.current_model_path == model_path:
                self.status = "ready"
                self.status_message = "Модель готова к генерации"
                return True

            # If already starting, wait for it to become ready
            if self.status == "starting":
                start_w = time.time()
                while time.time() - start_w < 30:
                    if self.is_alive():
                        self.status = "ready"
                        self.status_message = "Модель готова к генерации"
                        return True
                    time.sleep(0.5)

            self.stop()

            target = Path(model_path)
            if not target.exists():
                fn = target.name
                for d in self.get_models_dirs():
                    candidate = d / fn
                    if candidate.exists():
                        target = candidate
                        model_path = str(candidate.resolve())
                        break
            if not os.path.exists(model_path):
                self.status = "error"
                self.status_message = "Файл модели не найден. Скачайте модель через Каталог или используйте Cloud API (GigaChat / OpenRouter)"
                return False

            if not self.server_exe.exists():
                self.status = "error"
                self.status_message = f"Движок llama-server.exe не найден: {self.server_exe}"
                return False

            self.status = "starting"
            self.status_message = "Аллокация VRAM и запуск движка (Vulkan)..."
            self.current_model_path = model_path

            cmd = [
                str(self.server_exe),
                "-m", model_path,
                "-ngl", str(gpu_layers),
                "-c", str(context),
                "-t", str(threads),
                "--port", str(self.port),
                "--host", "127.0.0.1",
            ]
            if flash_attention:
                cmd.extend(["-fa", "on"])

            try:
                # Open log file to record stdout/stderr for diagnostics
                log_handle = open(self._log_file, "w", encoding="utf-8", errors="replace")

                self.process = subprocess.Popen(
                    cmd,
                    cwd=str(self.engine_dir),
                    stdout=log_handle,
                    stderr=subprocess.STDOUT,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
                )

                # Wait for server health check (model loading into VRAM)
                start_time = time.time()
                while time.time() - start_time < 35:
                    if self.process.poll() is not None:
                        self.status = "error"
                        err_tail = self._get_log_tail()
                        self.status_message = f"Процесс llama-server завершился с кодом {self.process.poll()}: {err_tail}"
                        return False
                    try:
                        res = requests.get(f"{self.base_url}/health", timeout=1)
                        if res.status_code == 200:
                            self.status = "ready"
                            self.status_message = "Модель готова к генерации"
                            return True
                    except Exception:
                        time.sleep(0.5)

                self.status = "error"
                self.status_message = "Таймаут инициализации llama-server (превышено 35 сек)"
                return False
            except Exception as e:
                self.status = "error"
                self.status_message = f"Ошибка запуска процесса: {e}"
                return False

    def _get_log_tail(self, lines: int = 5) -> str:
        try:
            if self._log_file.exists():
                with open(self._log_file, "r", encoding="utf-8", errors="replace") as f:
                    all_lines = f.readlines()
                    return " ".join([l.strip() for l in all_lines[-lines:] if l.strip()])
        except Exception:
            pass
        return ""

    def stop(self):
        if self.process:
            try:
                self.process.terminate()
                self.process.wait(timeout=2)
            except Exception:
                try:
                    self.process.kill()
                except Exception:
                    pass
            self.process = None

        # Clean any zombie llama-server processes on Windows instantly
        try:
            subprocess.run(
                ["taskkill.exe", "/F", "/IM", "llama-server.exe", "/T"],
                capture_output=True,
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
        except Exception:
            pass

        # Also ensure port 8080 is completely free
        try:
            res = subprocess.run(
                f'netstat -ano | findstr :{self.port}',
                shell=True,
                capture_output=True,
                text=True,
                timeout=2
            )
            for line in res.stdout.strip().splitlines():
                parts = line.strip().split()
                if len(parts) >= 5 and parts[-1].isdigit():
                    pid = parts[-1]
                    if int(pid) > 0 and int(pid) != os.getpid():
                        subprocess.run(f'taskkill /F /PID {pid}', shell=True, capture_output=True)
        except Exception:
            pass

        self.status = "idle"
        self.status_message = "Движок остановлен"

    def is_alive(self):
        if not self.process or self.process.poll() is not None:
            return False
        try:
            res = requests.get(f"{self.base_url}/health", timeout=1)
            return res.status_code == 200
        except Exception:
            return False
