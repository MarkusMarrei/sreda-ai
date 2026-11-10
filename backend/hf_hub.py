import os
import requests
import threading
from pathlib import Path

class HuggingFaceHub:
    def __init__(self, download_dir: Path):
        self.download_dir = download_dir
        self.active_download = None
        self.download_progress = {
            "status": "idle",
            "is_downloading": False,
            "filename": "",
            "progress": 0.0,
            "progress_percent": 0.0,
            "downloaded_bytes": 0,
            "downloaded_mb": 0.0,
            "total_bytes": 0,
            "total_mb": 0.0,
            "speed_mb_s": 0.0,
            "status_text": "",
            "error": ""
        }
        self._cancel_flag = False

    def search_models(self, query: str = "gguf", limit: int = 15):
        clean_q = query.strip() or "gguf"
        url = f"https://huggingface.co/api/models?search={clean_q}&filter=gguf&sort=downloads&direction=-1&limit={limit}"
        try:
            res = requests.get(url, timeout=10)
            if res.status_code == 200:
                data = res.json()
                results = []
                for item in data:
                    results.append({
                        "id": item.get("id", ""),
                        "likes": item.get("likes", 0),
                        "downloads": item.get("downloads", 0),
                        "pipeline_tag": item.get("pipeline_tag", "text-generation"),
                        "last_modified": item.get("lastModified", "")
                    })
                return results
        except Exception:
            pass
        return []

    def get_repo_files(self, repo_id: str, available_ram_gb: float = 12.0):
        url = f"https://huggingface.co/api/models/{repo_id}/tree/main"
        files = []
        try:
            res = requests.get(url, timeout=10)
            if res.status_code == 200:
                data = res.json()
                for item in data:
                    path = item.get("path", "")
                    if path.lower().endswith(".gguf"):
                        size = item.get("size", 0)
                        size_mb = size / (1024 * 1024)
                        size_text = f"{size_mb / 1024:.2f} ГБ" if size_mb >= 1024 else f"{size_mb:.0f} МБ"
                        download_url = f"https://huggingface.co/{repo_id}/resolve/main/{path}"

                        # Compatibility check
                        size_gb = round(size / (1024 ** 3), 2)
                        req_ram_gb = size_gb * 1.2
                        if req_ram_gb <= available_ram_gb:
                            compat = "recommended"
                            compat_text = "Рекомендуется"
                            is_compatible = True
                        elif req_ram_gb <= available_ram_gb * 1.25:
                            compat = "warning"
                            compat_text = "Внимание (высокая нагрузка)"
                            is_compatible = True
                        else:
                            compat = "not_recommended"
                            compat_text = "Не рекомендуется (нехватка RAM)"
                            is_compatible = False

                        files.append({
                            "filename": path,
                            "repo_id": repo_id,
                            "size_bytes": size,
                            "size_gb": size_gb,
                            "size_text": size_text,
                            "download_url": download_url,
                            "compatibility": compat,
                            "compatibility_text": compat_text,
                            "is_compatible": is_compatible
                        })
        except Exception:
            pass
        return sorted(files, key=lambda x: x["size_bytes"])

    def start_download(self, url: str, filename: str):
        if self.download_progress["is_downloading"]:
            return False

        self._cancel_flag = False
        final_path = self.download_dir / filename
        temp_path = self.download_dir / (filename + ".part")
        self.download_dir.mkdir(parents=True, exist_ok=True)

        self.download_progress["status"] = "downloading"
        self.download_progress["is_downloading"] = True
        self.download_progress["filename"] = filename
        self.download_progress["progress"] = 0.0
        self.download_progress["progress_percent"] = 0.0
        self.download_progress["downloaded_bytes"] = 0
        self.download_progress["downloaded_mb"] = 0.0
        self.download_progress["total_bytes"] = 0
        self.download_progress["total_mb"] = 0.0
        self.download_progress["speed_mb_s"] = 0.0
        self.download_progress["status_text"] = "Подключение к Hugging Face..."
        self.download_progress["error"] = ""

        def worker():
            import time
            try:
                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SredaAI/5.0"}
                with requests.get(url, stream=True, headers=headers, timeout=30) as r:
                    r.raise_for_status()
                    total = int(r.headers.get("content-length", 0))
                    self.download_progress["total_bytes"] = total
                    self.download_progress["total_mb"] = round(total / (1024 * 1024), 1)
                    downloaded = 0
                    start_time = time.time()
                    last_time = start_time
                    last_downloaded = 0

                    with open(temp_path, "wb") as f:
                        for chunk in r.iter_content(chunk_size=1024 * 512):
                            if self._cancel_flag:
                                self.download_progress["status"] = "cancelled"
                                self.download_progress["status_text"] = "Загрузка отменена пользователем"
                                try:
                                    if temp_path.exists():
                                        temp_path.unlink()
                                except Exception:
                                    pass
                                break

                            if chunk:
                                f.write(chunk)
                                downloaded += len(chunk)
                                self.download_progress["downloaded_bytes"] = downloaded
                                dl_mb = round(downloaded / (1024 * 1024), 1)
                                self.download_progress["downloaded_mb"] = dl_mb
                                if total > 0:
                                    pct = round((downloaded / total) * 100, 1)
                                    self.download_progress["progress"] = round(downloaded / total, 3)
                                    self.download_progress["progress_percent"] = pct

                                now = time.time()
                                if now - last_time >= 0.2:
                                    speed = (downloaded - last_downloaded) / (1024 * 1024) / max(0.01, now - last_time)
                                    self.download_progress["speed_mb_s"] = round(speed, 1)
                                    self.download_progress["status_text"] = (
                                        f"Скачивание: {dl_mb:.1f} / {self.download_progress['total_mb']:.1f} МБ ({speed:.1f} МБ/с)"
                                    )
                                    last_time = now
                                    last_downloaded = downloaded

                    if not self._cancel_flag:
                        if temp_path.exists():
                            if final_path.exists():
                                final_path.unlink()
                            temp_path.replace(final_path)

                        self.download_progress["status"] = "completed"
                        self.download_progress["progress"] = 1.0
                        self.download_progress["progress_percent"] = 100.0
                        self.download_progress["status_text"] = "Загрузка успешно завершена!"
            except Exception as e:
                self.download_progress["status"] = "error"
                self.download_progress["error"] = str(e)
                self.download_progress["status_text"] = f"Ошибка загрузки: {e}"
                try:
                    if temp_path.exists():
                        temp_path.unlink()
                except Exception:
                    pass
            finally:
                self.download_progress["is_downloading"] = False

        t = threading.Thread(target=worker, daemon=True)
        t.start()
        return True

    def cancel_download(self):
        self._cancel_flag = True
        self.download_progress["status"] = "cancelled"
