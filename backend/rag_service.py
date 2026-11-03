import os
import re
import time
import subprocess
from pathlib import Path
import docx
import pymupdf
import pypdf

class RagService:
    def __init__(self, base_dir: Path = None, audio_service = None):
        if base_dir is None:
            base_dir = Path(__file__).resolve().parent.parent
        self.base_dir = Path(base_dir)
        self.audio_service = audio_service

        user_profile = os.environ.get("USERPROFILE", "C:\\Users\\Public")
        self.uploads_dir = Path(user_profile) / "SredaAI" / "generated" / "uploads"
        self.uploads_dir.mkdir(parents=True, exist_ok=True)
        self.ffmpeg_bin = self.base_dir / "engine" / "ffmpeg.exe"

    def set_audio_service(self, audio_service):
        self.audio_service = audio_service

    def process_file(self, file_path: Path | str) -> dict:
        file_path = Path(file_path)
        if not file_path.exists():
            return {"success": False, "error": "Файл не найден"}

        ext = file_path.suffix.lower()
        size_bytes = file_path.stat().st_size

        # 1. Audio & Video Media Files (.mp3, .wav, .mp4, .m4a, .ogg, .mov, .mkv, .flac)
        if ext in ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.mp4', '.mov', '.mkv']:
            is_video = ext in ['.mp4', '.mov', '.mkv']
            media_type = "video" if is_video else "audio"

            if not self.audio_service:
                return {
                    "success": False,
                    "error": "Аудио-сервис Whisper не подключен к RAG"
                }

            try:
                temp_dir = self.uploads_dir / "temp_media"
                temp_dir.mkdir(parents=True, exist_ok=True)
                ts = int(time.time() * 1000)
                temp_16k = temp_dir / f"rag_conv_{ts}.wav"

                # Extract audio, resample to 16kHz mono, and slice to 300 seconds (5 minutes max)
                duration_sec = 0.0
                was_trimmed = False

                if self.ffmpeg_bin.exists():
                    # Probe duration first
                    probe_cmd = [
                        str(self.ffmpeg_bin),
                        "-i", str(file_path)
                    ]
                    probe = subprocess.run(probe_cmd, capture_output=True, text=True, errors="replace")
                    dur_match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", probe.stderr)
                    if dur_match:
                        h, m, s = float(dur_match.group(1)), float(dur_match.group(2)), float(dur_match.group(3))
                        duration_sec = h * 3600 + m * 60 + s
                        if duration_sec > 300:
                            was_trimmed = True

                    # Convert / slice with ffmpeg
                    cmd = [
                        str(self.ffmpeg_bin),
                        "-y",
                        "-i", str(file_path),
                        "-t", "300",  # Max 5 minutes
                        "-vn",         # Drop video stream
                        "-ar", "16000",
                        "-ac", "1",
                        "-c:a", "pcm_s16le",
                        str(temp_16k)
                    ]
                    conv = subprocess.run(
                        cmd,
                        capture_output=True,
                        text=True,
                        errors="replace",
                        timeout=45,
                        creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
                    )
                    if conv.returncode != 0:
                        return {"success": False, "error": f"Ошибка конвертации медиа: {conv.stderr}"}
                else:
                    # If ffmpeg missing and it's already a wav, use directly
                    if ext == '.wav':
                        temp_16k = file_path
                    else:
                        return {"success": False, "error": "Конвертер FFmpeg не найден в папке engine"}

                # Run Whisper.cpp transcription
                trans_res = self.audio_service.transcribe_audio(temp_16k, language="auto")

                # Clean up temporary converted wav
                try:
                    if temp_16k.exists() and temp_16k != file_path:
                        temp_16k.unlink()
                except Exception:
                    pass

                if not trans_res.get("success"):
                    return {"success": False, "error": trans_res.get("error", "Ошибка транскрибации медиа")}

                extracted_text = trans_res.get("text", "").strip()

                return {
                    "success": True,
                    "type": media_type,
                    "doc_category": media_type,
                    "filename": file_path.name,
                    "ext": ext,
                    "size_bytes": size_bytes,
                    "duration_sec": round(duration_sec, 1),
                    "was_trimmed": was_trimmed,
                    "char_count": len(extracted_text),
                    "text": extracted_text,
                    "preview": extracted_text[:140].strip() if extracted_text else "Речь не обнаружена"
                }
            except Exception as e:
                return {"success": False, "error": f"Ошибка обработки медиафайла: {e}"}

        # 2. Word Documents (.docx, .doc)
        elif ext in ['.docx']:
            try:
                doc = docx.Document(str(file_path))
                parts = []
                for p in doc.paragraphs:
                    t = p.text.strip()
                    if t:
                        parts.append(t)
                for table in doc.tables:
                    for row in table.rows:
                        row_vals = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                        if row_vals:
                            parts.append(" | ".join(row_vals))
                extracted_text = "\n".join(parts)
                return {
                    "success": True,
                    "type": "document",
                    "doc_category": "word",
                    "filename": file_path.name,
                    "ext": ext,
                    "size_bytes": size_bytes,
                    "char_count": len(extracted_text),
                    "text": extracted_text,
                    "preview": extracted_text[:120].strip()
                }
            except Exception as e:
                return {"success": False, "error": f"Ошибка чтения Word документа: {str(e)}"}

        # 3. PDF Documents (.pdf)
        elif ext in ['.pdf']:
            try:
                doc = pymupdf.open(str(file_path))
                pages = []
                for page_idx, page in enumerate(doc):
                    t = page.get_text()
                    if t.strip():
                        pages.append(f"[Страница {page_idx + 1}]\n{t.strip()}")
                extracted_text = "\n\n".join(pages)
                return {
                    "success": True,
                    "type": "document",
                    "doc_category": "pdf",
                    "filename": file_path.name,
                    "ext": ext,
                    "size_bytes": size_bytes,
                    "char_count": len(extracted_text),
                    "page_count": len(doc),
                    "text": extracted_text,
                    "preview": extracted_text[:120].strip()
                }
            except Exception as e:
                return {"success": False, "error": f"Ошибка чтения PDF: {str(e)}"}

        # 4. Plain Text / Markdown / Code / Tabular
        elif ext in ['.txt', '.md', '.markdown', '.json', '.csv', '.py', '.js', '.html', '.xml', '.log', '.yaml', '.yml']:
            extracted_text = None
            for enc in ['utf-8', 'cp1251', 'latin-1']:
                try:
                    with open(file_path, 'r', encoding=enc) as f:
                        extracted_text = f.read()
                    break
                except Exception:
                    continue

            if extracted_text is not None:
                return {
                    "success": True,
                    "type": "document",
                    "doc_category": "text",
                    "filename": file_path.name,
                    "ext": ext,
                    "size_bytes": size_bytes,
                    "char_count": len(extracted_text),
                    "text": extracted_text,
                    "preview": extracted_text[:120].strip()
                }
            return {"success": False, "error": "Не удалось определить текстовую кодировку файла"}

        else:
            return {"success": False, "error": f"Неподдерживаемый формат файла: {ext}"}

    def format_document_context_for_prompt(self, doc_data: dict, max_chars: int = 15000) -> str:
        if not doc_data.get("success") or not doc_data.get("text"):
            return ""

        filename = doc_data.get("filename", "Файл")
        text = doc_data.get("text", "").strip()
        doc_category = doc_data.get("doc_category", "файл").lower()

        if doc_category in ["audio", "video"]:
            trim_note = " (первые 5 минут записи)" if doc_data.get("was_trimmed") else ""
            dur_info = f", длительность ~{int(doc_data.get('duration_sec', 0))} сек." if doc_data.get("duration_sec") else ""
            return (
                f"\n\n[ПРИКРЕПЛЁННАЯ {doc_category.upper()}-ЗАПИСЬ: {filename}{trim_note}{dur_info}]:\n"
                f"Стенограмма речи (распознано локально через Whisper.cpp):\n"
                f"\"\"\"\n{text}\n\"\"\"\n"
                f"[ИНСТРУКЦИЯ К ЗАПИСИ]: Внимательно используй содержание расшифрованной аудио/видеозаписи выше "
                f"для точного ответа на вопросы пользователя."
            )

        if len(text) > max_chars:
            text = text[:max_chars] + f"\n... [Текст сокращён, показаны первые {max_chars} символов из {len(doc_data.get('text'))}]"

        return (
            f"\n\n[ПРИКРЕПЛЁННЫЙ ДОКУМЕНТ: {filename} ({doc_category.upper()})]:\n"
            f"```\n{text}\n```\n"
            f"[ИНСТРУКЦИЯ К ДОКУМЕНТУ]: Внимательно изучи предоставленный текст документа выше, "
            f"отвечай на вопросы пользователя с опорой на факты и содержание этого документа."
        )
