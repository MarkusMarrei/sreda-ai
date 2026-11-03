"""SREDA AI — Multimodal Model Setup & Downloader
Automated setup script for offline neural network weights.
Downloads weights directly from official Hugging Face repositories.
"""

import os
import sys
import time
import urllib.request
from pathlib import Path

# Force UTF-8 stdout
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"

# Model definitions with source URLs and target paths
MODELS = {
    "whisper_tiny": {
        "title": "Whisper STT (Распознавание речи, ggml-tiny)",
        "dest": MODELS_DIR / "audio" / "whisper" / "ggml-tiny.bin",
        "url": "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin",
        "size_mb": 75,
        "category": "audio"
    },
    "piper_ru_dmitri": {
        "title": "Piper TTS (Русский голос Дмитрий, medium)",
        "dest": MODELS_DIR / "audio" / "piper" / "ru" / "ru_RU-dmitri-medium.onnx",
        "url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/dmitri/medium/ru_RU-dmitri-medium.onnx",
        "size_mb": 62,
        "category": "audio"
    },
    "piper_ru_irina": {
        "title": "Piper TTS (Русский голос Ирина, medium)",
        "dest": MODELS_DIR / "audio" / "piper" / "ru" / "ru_RU-irina-medium.onnx",
        "url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/ru/ru_RU/irina/medium/ru_RU-irina-medium.onnx",
        "size_mb": 62,
        "category": "audio"
    },
    "piper_en_lessac": {
        "title": "Piper TTS (English Voice Lessac, medium)",
        "dest": MODELS_DIR / "audio" / "piper" / "en" / "en_US-lessac-medium.onnx",
        "url": "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx",
        "size_mb": 62,
        "category": "audio"
    },
    "sd_sdxs": {
        "title": "Stable Diffusion (SDXS-512 Distilled 1-step, Q8_0 GGUF)",
        "dest": MODELS_DIR / "sd" / "sdxs-512-tinySDdistilled_Q8_0.gguf",
        "url": "https://huggingface.co/second-state/sdxs-512-0.9-GGUF/resolve/main/sdxs-512-tinySDdistilled_Q8_0.gguf",
        "size_mb": 651,
        "category": "image"
    },
    "llm_bonsai_2": {
        "title": "Ternary-Bonsai-2-9B (Рекомендуемая текстовая модель, PTQ1_0 GGUF)",
        "dest": MODELS_DIR / "Ternary-Bonsai-2-9B-PTQ1_0.gguf",
        "url": "https://huggingface.co/Bonsai-AI/Ternary-Bonsai-2-9B-GGUF/resolve/main/Ternary-Bonsai-2-9B-PTQ1_0.gguf",
        "size_mb": 1905,
        "category": "llm"
    }
}

def print_banner():
    print("=" * 68)
    print("       SREDA AI — Мастер быстрой загрузки моделей (Setup)")
    print("    Официальные репозитории Hugging Face | Локальный инференс")
    print("=" * 68)
    print()

def download_with_progress(url: str, dest_path: Path, title: str):
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = dest_path.with_suffix(".downloading")

    print(f"[*] Скачивание: {title}")
    print(f"    URL:  {url}")
    print(f"    Куда: {dest_path.name}")

    start_time = time.time()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "SredaAI-Downloader/9.0"})
        with urllib.request.urlopen(req, timeout=120) as resp:
            total_size = int(resp.headers.get("content-length", 0))
            downloaded = 0
            chunk_size = 1024 * 512 # 512 KB chunks

            with open(temp_path, "wb") as f:
                while True:
                    chunk = resp.read(chunk_size)
                    if not chunk:
                        break
                    f.write(chunk)
                    downloaded += len(chunk)

                    if total_size > 0:
                        percent = downloaded * 100 / total_size
                        mb_down = downloaded / (1024 * 1024)
                        mb_tot = total_size / (1024 * 1024)
                        speed = mb_down / max(0.1, time.time() - start_time)
                        sys.stdout.write(f"\r    Прогресс: [{percent:5.1f}%] {mb_down:.1f}/{mb_tot:.1f} МБ ({speed:.2f} МБ/с)")
                        sys.stdout.flush()
                    else:
                        mb_down = downloaded / (1024 * 1024)
                        sys.stdout.write(f"\r    Скачано: {mb_down:.1f} МБ")
                        sys.stdout.flush()

        print()
        if temp_path.exists():
            if dest_path.exists():
                dest_path.unlink()
            temp_path.rename(dest_path)
        print(f"[✓] Успешно загружено: {dest_path.name}\n")
        return True
    except Exception as e:
        print(f"\n[!] Ошибка загрузки: {e}\n")
        if temp_path.exists():
            try:
                temp_path.unlink()
            except Exception:
                pass
        return False

def check_installed_status():
    installed = {}
    for key, info in MODELS.items():
        p = info["dest"]
        exists = p.exists() and p.stat().st_size > 1000
        size_str = f"({p.stat().st_size / (1024*1024):.0f} МБ)" if exists else f"(~{info['size_mb']} МБ)"
        installed[key] = (exists, size_str)
    return installed

def main():
    print_banner()

    status = check_installed_status()
    print("Текущий статус моделей в папке проекта:")
    for idx, (key, info) in enumerate(MODELS.items(), 1):
        is_inst, sz = status[key]
        tag = "[УСТАНОВЛЕНО]" if is_inst else "[НЕ НАЙДЕНО ]"
        print(f" {idx}. {tag} {info['title']} {sz}")

    print("\nВарианты установки:")
    print(" 1) Быстрый старт: Речь + Голоса (Whisper + Piper TTS, ~260 МБ)")
    print(" 2) Графика: Stable Diffusion SDXS-512 (~650 МБ)")
    print(" 3) Текстовая модель: Ternary-Bonsai-2-9B GGUF (~1.9 ГБ)")
    print(" 4) Загрузить ВСЁ необходимое для полной офлайн-работы (~2.8 ГБ)")
    print(" 5) Использовать облачные API (GigaChat / OpenRouter) — 0 МБ локально")
    print(" 0) Выход")
    print()

    choice = input("Выберите вариант (0-5) [по умолчанию 1]: ").strip()
    if not choice:
        choice = "1"

    if choice == "0":
        print("Выход.")
        return

    to_download = []
    if choice == "1":
        to_download = ["whisper_tiny", "piper_ru_dmitri", "piper_ru_irina", "piper_en_lessac"]
    elif choice == "2":
        to_download = ["sd_sdxs"]
    elif choice == "3":
        to_download = ["llm_bonsai_2"]
    elif choice == "4":
        to_download = list(MODELS.keys())
    elif choice == "5":
        print("\n[*] Облачные API не требуют скачивания локальных моделей.")
        print("[*] Запустите приложение через run.bat и включите GigaChat или OpenRouter в Настройках.")
        input("\nНажмите Enter для завершения...")
        return
    else:
        print("[!] Неверный ввод.")
        return

    print("\n" + "=" * 68)
    for key in to_download:
        info = MODELS[key]
        if info["dest"].exists() and info["dest"].stat().st_size > 1000:
            print(f"[✓] {info['title']} уже установлена, пропуск.")
            continue
        download_with_progress(info["url"], info["dest"], info["title"])

    print("=" * 68)
    print("[✓] Процесс настройки моделей завершен!")
    print("[*] Теперь вы можете запустить SREDA AI командой run.bat")
    print("=" * 68)
    input("\nНажмите Enter для выхода...")

if __name__ == "__main__":
    main()
