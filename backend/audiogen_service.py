"""AudioLDM Foley & Sound Effects Service for SREDA AI.
Generates genuine physical sound effects, ambient audio, and foley using neural latent diffusion (cvssp/audioldm-s-full-v2).
"""

import os
import sys
import time
import logging
import subprocess
from pathlib import Path
from typing import Dict, Any, Optional

logger = logging.getLogger("sreda.audiogen")

class AudioGenService:
    def __init__(self, base_dir: Path):
        self.base_dir = Path(base_dir)
        self.venv_python = self.base_dir / "engine" / "venv_audio" / "Scripts" / "python.exe"
        self.generator_script = self.base_dir / "backend" / "audioldm_generator.py"

    def enhance_foley_prompt(self, prompt: str) -> str:
        """Map Russian or brief sound descriptions to authentic foley prompts."""
        p_low = prompt.lower().strip()
        
        # Dictionary of realistic foley acoustic profiles
        FOLEY_MAP = [
            (["мяук", "кошк", "кот", "котенок", "cat", "meow"], "A domestic cat meowing clearly, authentic close-up field recording, natural room acoustics"),
            (["лай", "собак", "пес", "щенок", "bark", "dog"], "Realistic dog bark, loud and clear animal sound effect, outdoor yard acoustic"),
            (["шаг", "топот", "идет", "ступни", "footstep", "walk"], "Heavy footsteps walking on wooden floorboards, close perspective, clear heel-toe impact"),
            (["дожд", "ливень", "капли", "rain"], "Gentle rain falling on a window and rooftop, soothing natural rain ambience, stereo audio"),
            (["двер", "скрип", "хлоп", "door", "creak"], "Creaky wooden door slowly opening with a sharp eerie hinge squeak, indoor room"),
            (["ветер", "буря", "вьюга", "wind"], "Howling cold winter wind blowing through trees, outdoor atmospheric sound effect"),
            (["гром", "гроза", "молния", "thunder"], "Loud dramatic thunder crack followed by deep rolling rumble in the distance"),
            (["огонь", "костер", "треск", "fire"], "Campfire burning with soothing wood crackling and popping embers, close stereo recording"),
            (["вода", "ручей", "река", "water", "stream"], "Crystal clear water splashing and flowing in a natural mountain stream"),
            (["колокол", "звон", "bell", "chime"], "Deep resonant church bell ringing once, lingering bronze overtone reverb"),
            (["выстрел", "пистолет", "взрыв", "shot", "gun"], "Punchy cinematic gunshot with mechanical action and echo"),
            (["машин", "двигател", "мотор", "car", "engine"], "Car engine starting and idling smoothly, mechanical motor sound"),
            (["клавиатур", "печать", "клики", "keyboard", "typing"], "Mechanical keyboard typing sound, crisp tactile switch clicks"),
            (["птиц", "пение", "чириканье", "birds", "chirp"], "Forest birds chirping and singing cheerfully in early morning, nature ambience")
        ]

        for keywords, enriched in FOLEY_MAP:
            if any(k in p_low for k in keywords):
                return enriched

        return f"{prompt}, realistic authentic sound effect, crisp foley recording, high audio fidelity"

    def generate_sound(self, prompt: str, output_path: Path, duration_sec: float = 3.0, steps: int = 15) -> Dict[str, Any]:
        """Run AudioLDM in the dedicated audio environment to create a WAV file."""
        t0 = time.time()
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        if not self.venv_python.exists():
            return {
                "success": False,
                "error": f"Окружение audio venv не найдено: {self.venv_python}"
            }

        enhanced = self.enhance_foley_prompt(prompt)
        logger.info(f"Generating sound via AudioLDM: '{prompt}' -> '{enhanced}' ({duration_sec}s)")

        cmd = [
            str(self.venv_python),
            str(self.generator_script),
            "--prompt", enhanced,
            "--output", str(output_path),
            "--duration", str(max(1.0, min(10.0, float(duration_sec)))),
            "--steps", str(steps)
        ]

        try:
            res = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=90
            )

            if res.returncode != 0:
                logger.error(f"AudioLDM generation failed: {res.stderr}")
                return {
                    "success": False,
                    "error": f"Ошибка генерации звука: {res.stderr or res.stdout}"
                }

            if not output_path.exists() or output_path.stat().st_size < 1000:
                return {
                    "success": False,
                    "error": "Файл звука не был создан или имеет нулевой размер"
                }

            elapsed = round(time.time() - t0, 2)
            logger.info(f"AudioLDM successfully generated sound in {elapsed}s -> {output_path.name}")
            return {
                "success": True,
                "file_path": str(output_path),
                "duration": duration_sec,
                "elapsed_sec": elapsed,
                "model": "AudioLDM (Neural Latent Diffusion)"
            }
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Таймаут генерации звука AudioLDM (превышено 90 секунд)"}
        except Exception as e:
            logger.error(f"Unexpected error in AudioGenService: {e}", exc_info=True)
            return {"success": False, "error": str(e)}
