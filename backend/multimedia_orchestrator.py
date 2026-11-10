import os
import re
import time
import subprocess
import math
import struct
import wave
import random
from pathlib import Path

try:
    from .musicgen_service import MusicGenService
    from .audiogen_service import AudioGenService
except ImportError:
    from musicgen_service import MusicGenService
    from audiogen_service import AudioGenService

class MultimediaOrchestrator:
    def __init__(self, base_dir: Path = None):
        if base_dir is None:
            base_dir = Path(__file__).resolve().parent.parent
        self.base_dir = Path(base_dir)

        # Output storage directory (mounted at /static/generated)
        user_profile = os.environ.get("USERPROFILE", "C:\\Users\\Public")
        self.output_base = Path(user_profile) / "SredaAI" / "generated"
        self.output_base.mkdir(parents=True, exist_ok=True)
        (self.output_base / "images").mkdir(exist_ok=True)
        (self.output_base / "audio").mkdir(exist_ok=True)
        (self.output_base / "uploads").mkdir(exist_ok=True)

        self.sd_bin = self.base_dir / "engine" / "sd" / "sd-cli.exe"
        self.sd_models_dir = self.base_dir / "models" / "sd"
        self.sd_models_dir.mkdir(parents=True, exist_ok=True)
        
        # Neural Music Generation Subsystem (MusicGen Small 24-Layer INT8 ONNX)
        self.musicgen = MusicGenService(self.base_dir / "models" / "audio" / "musicgen")
        # Neural Sound Effects / Foley Subsystem (AudioLDM Neural Latent Diffusion)
        self.audiogen = AudioGenService(self.base_dir)
        self.is_busy = False

    def get_sd_model_path(self) -> Path | None:
        """Find the active Stable Diffusion GGUF model."""
        if not self.sd_models_dir.exists():
            return None
        models = list(self.sd_models_dir.glob("*.gguf"))
        if models:
            return models[0]
        return None

    def parse_tools_from_text(self, text: str):
        """Parse tool calls from Bonsai 2 text stream or response."""
        calls = []

        # 1. Standard bracket syntax: [TOOL_CALL: generate_image(prompt="...")]
        for m in re.finditer(r'\[TOOL_CALL:\s*(\w+)\((.*?)\)\]', text, re.IGNORECASE | re.DOTALL):
            tool_name = m.group(1).lower()
            args_raw = m.group(2)
            args = {}
            for param in re.finditer(r'(\w+)=["\']([^"\']+)["\']', args_raw):
                args[param.group(1)] = param.group(2)
            for param in re.finditer(r'(\w+)=(\d+)', args_raw):
                args[param.group(1)] = int(param.group(2))
            calls.append({"type": tool_name, "args": args, "raw": m.group(0)})

        # 2. Legacy [IMAGE_GEN: prompt="..."]
        for m in re.finditer(r'\[IMAGE_GEN:\s*prompt="([^"]+)"\]', text, re.IGNORECASE):
            calls.append({"type": "generate_image", "args": {"prompt": m.group(1)}, "raw": m.group(0)})

        # 3. Legacy [MUSIC_GEN: prompt="...", duration=10]
        for m in re.finditer(r'\[MUSIC_GEN:\s*prompt="([^"]+)"(?:,\s*duration=(\d+))?\]', text, re.IGNORECASE):
            duration = int(m.group(2)) if m.group(2) else 8
            calls.append({"type": "generate_music", "args": {"prompt": m.group(1), "duration": duration}, "raw": m.group(0)})

        # 4. Legacy [SOUND_GEN: prompt="..."]
        for m in re.finditer(r'\[SOUND_GEN:\s*prompt="([^"]+)"\]', text, re.IGNORECASE):
            calls.append({"type": "generate_sound", "args": {"prompt": m.group(1)}, "raw": m.group(0)})

        return calls

    def generate_image(self, prompt: str, steps: int = 2, cfg_scale: float = 1.5, width: int = 512, height: int = 512):
        """Generate an image using sd.cpp with Vulkan GPU acceleration."""
        self.is_busy = True
        ts = int(time.time() * 1000)
        target = self.output_base / "images" / f"img_{ts}.png"
        model_path = self.get_sd_model_path()

        t0 = time.time()
        try:
            if self.sd_bin.exists() and model_path and model_path.exists():
                cmd = [
                    str(self.sd_bin),
                    "-m", str(model_path),
                    "-p", prompt,
                    "-o", str(target),
                    "--steps", str(steps),
                    "--cfg-scale", str(cfg_scale),
                    "-W", str(width),
                    "-H", str(height),
                    "--sampling-method", "euler_a"
                ]

                proc = subprocess.run(
                    cmd,
                    cwd=str(self.sd_bin.parent),
                    capture_output=True,
                    text=True,
                    timeout=90,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
                )

                if target.exists() and target.stat().st_size > 1000:
                    elapsed = round(time.time() - t0, 2)
                    return {
                        "success": True,
                        "type": "image",
                        "file_path": str(target),
                        "url": f"/static/generated/images/{target.name}",
                        "prompt": prompt,
                        "duration_sec": elapsed,
                        "engine": "sd.cpp (Vulkan AMD Radeon 780M)",
                        "model": model_path.name
                    }

            # Fallback placeholder if binary or model missing
            from PIL import Image, ImageDraw
            img = Image.new('RGB', (width, height), color=(20, 22, 28))
            draw = ImageDraw.Draw(img)
            draw.rectangle([10, 10, width - 10, height - 10], outline=(239, 68, 68), width=2)
            draw.text((25, height // 2 - 20), f"SREDA AI - SD Generator Preview:\n{prompt[:60]}", fill=(240, 240, 240))
            img.save(target)
            return {
                "success": True,
                "type": "image",
                "file_path": str(target),
                "url": f"/static/generated/images/{target.name}",
                "prompt": prompt,
                "duration_sec": round(time.time() - t0, 2),
                "is_preview": True
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            self.is_busy = False

    def generate_music(self, prompt: str, duration: int = 5):
        """Generate authentic neural music using MusicGen Tiny ONNX."""
        self.is_busy = True
        ts = int(time.time() * 1000)
        target = self.output_base / "audio" / f"music_{ts}.wav"
        t0 = time.time()

        try:
            duration_sec = max(3.0, min(float(duration), 15.0))
            wav_data = self.musicgen.generate_music(prompt, duration_sec=duration_sec)

            if wav_data is not None and len(wav_data) > 0:
                self.musicgen.save_wav(wav_data, target, sample_rate=32000)
                elapsed = round(time.time() - t0, 2)
                return {
                    "success": True,
                    "type": "music",
                    "file_path": str(target),
                    "url": f"/static/generated/audio/{target.name}",
                    "prompt": prompt,
                    "duration_sec": elapsed,
                    "engine": "MusicGen Small (Meta AI 24-Layer INT8 ONNX)"
                }
            
            # Fallback to acoustic physical synthesis if ONNX sessions failed
            return self._generate_acoustic_fallback(prompt, duration_sec, target, t0)
        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            self.is_busy = False

    def _karplus_strong(self, freq: float, duration_sec: float, sample_rate: int = 44100, damping: float = 0.988):
        """Acoustic string physical modeling for guitars and plucks."""
        n_samples = int(duration_sec * sample_rate)
        buffer_len = max(2, int(sample_rate / max(25.0, freq)))
        delay_buffer = [random.uniform(-1.0, 1.0) for _ in range(buffer_len)]
        samples = []
        prev = 0.0
        for i in range(n_samples):
            curr = delay_buffer[i % buffer_len]
            filtered = 0.5 * (curr + prev) * damping
            prev = curr
            delay_buffer[i % buffer_len] = filtered
            samples.append(filtered)
        return samples

    def _generate_acoustic_fallback(self, prompt: str, duration_sec: float, target: Path, t0: float):
        """Fallback acoustic synthesizer if neural weights are temporarily unavailable."""
        sample_rate = 44100
        total_samples = int(sample_rate * duration_sec)
        samples = [0.0] * total_samples
        notes = [110.0, 164.81, 220.0, 261.63, 329.63, 261.63, 220.0, 164.81]
        note_dt = 0.45
        for idx, freq in enumerate(notes):
            st = int(idx * note_dt * sample_rate)
            pluck = self._karplus_strong(freq, 2.0, sample_rate=sample_rate)
            for s_idx, s in enumerate(pluck):
                if st + s_idx < total_samples:
                    samples[st + s_idx] += s * 0.4

        self._write_pcm_wav(samples, target, sample_rate)
        return {
            "success": True,
            "type": "music",
            "file_path": str(target),
            "url": f"/static/generated/audio/{target.name}",
            "prompt": prompt,
            "duration_sec": round(time.time() - t0, 2),
            "engine": "Acoustic Synthesizer (Fallback)"
        }

    def _write_pcm_wav(self, samples: list, target: Path, sample_rate: int = 44100):
        """Normalize samples and write 16-bit PCM WAV."""
        max_val = max(0.001, max(abs(s) for s in samples))
        scale = 0.95 / max_val if max_val > 0.95 else 1.0

        with wave.open(str(target), 'w') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            raw_data = bytearray()
            for s in samples:
                clipped = max(-1.0, min(1.0, s * scale))
                int_sample = int(clipped * 32767.0)
                raw_data.extend(struct.pack('<h', int_sample))
            wav_file.writeframes(raw_data)

    def generate_sound(self, prompt: str, duration: int = 3):
        """Generate high-quality acoustic, Foley, animal, and environmental sound effects using AudioLDM."""
        self.is_busy = True
        ts = int(time.time() * 1000)
        target = self.output_base / "audio" / f"sfx_{ts}.wav"
        t0 = time.time()

        try:
            duration_sec = max(1.5, min(float(duration), 10.0))

            # 1. Primary: AudioLDM Neural Diffusion Foley Generator
            res = self.audiogen.generate_sound(prompt, target, duration_sec=duration_sec, steps=15)
            if res.get("success") and target.exists() and target.stat().st_size > 1000:
                elapsed = round(time.time() - t0, 2)
                return {
                    "success": True,
                    "type": "sound",
                    "file_path": str(target),
                    "url": f"/static/generated/audio/{target.name}",
                    "prompt": prompt,
                    "duration_sec": elapsed,
                    "engine": "AudioLDM (Neural Latent Diffusion)"
                }

            # 2. Fallback: Procedural physical / acoustic synthesis if AudioLDM environment failed
            sample_rate = 44100
            prompt_lower = prompt.lower()
            total_samples = int(sample_rate * duration_sec)
            samples = [0.0] * total_samples

            # 1. CAT MEOW / KITTEN (Formant vocal tract with pitch rise & vibrato)
            if any(w in prompt_lower for w in ["cat", "meow", "кот", "кошк", "мяу", "кошач", "котенок", "котёнок"]):
                cat_dur = min(2.5, duration_sec)
                cat_samples = int(cat_dur * sample_rate)
                for i in range(cat_samples):
                    t = i / sample_rate
                    prog = t / cat_dur
                    if prog < 0.35:
                        f0 = 380.0 + (750.0 - 380.0) * (prog / 0.35) ** 0.8
                    elif prog < 0.7:
                        f0 = 750.0 - (750.0 - 520.0) * ((prog - 0.35) / 0.35)
                    else:
                        f0 = 520.0 - (520.0 - 400.0) * ((prog - 0.7) / 0.3)
                    vib = 1.0 + 0.025 * math.sin(2.0 * math.pi * 5.5 * t)
                    freq = f0 * vib
                    harm1 = math.sin(2.0 * math.pi * freq * t)
                    harm2 = 0.55 * math.sin(4.0 * math.pi * freq * t)
                    harm3 = 0.30 * math.sin(6.0 * math.pi * freq * t)
                    harm4 = 0.15 * math.sin(8.0 * math.pi * freq * t)
                    voice = harm1 + harm2 + harm3 + harm4
                    if prog < 0.12:
                        env = (prog / 0.12) ** 1.5
                    elif prog < 0.8:
                        env = 1.0 - 0.25 * ((prog - 0.12) / 0.68)
                    else:
                        env = 0.75 * ((1.0 - prog) / 0.2) ** 1.8
                    if i < total_samples:
                        samples[i] = voice * env * 0.85

            # 2. DOG BARK / PUPPY (Acoustic cavity resonator with pressure burst)
            elif any(w in prompt_lower for w in ["dog", "bark", "лай", "собак", "пес", "пёс", "гав", "щенок"]):
                bark_starts = [0.15, 0.75]
                for bt in bark_starts:
                    start_s = int(bt * sample_rate)
                    b_len = int(0.34 * sample_rate)
                    for i in range(b_len):
                        t = i / sample_rate
                        prog = t / 0.34
                        f0 = 440.0 * (1.0 - 0.48 * prog)
                        noise = random.uniform(-0.35, 0.35) * math.exp(-5.5 * prog)
                        body = (math.sin(2.0 * math.pi * f0 * t) +
                                0.65 * math.sin(4.0 * math.pi * f0 * t) +
                                0.35 * math.sin(6.0 * math.pi * f0 * t))
                        env = (math.sin(math.pi * prog) ** 0.55) * math.exp(-3.2 * prog)
                        val = (body + noise) * env * 0.85
                        if start_s + i < total_samples:
                            samples[start_s + i] += val

            # 3. FOOTSTEPS / WALKING / RUNNING / STOMP ("топот шагов", "шаги", "топот")
            elif any(w in prompt_lower for w in ["топот", "шаг", "footstep", "footsteps", "ходьб", "бег", "ступн"]):
                cadence = 0.45  # step interval in seconds
                num_steps = int(duration_sec / cadence)
                for s_num in range(num_steps):
                    st = (s_num + 0.3) * cadence
                    start_s = int(st * sample_rate)
                    step_len = int(0.18 * sample_rate)
                    is_left = (s_num % 2 == 0)
                    base_f = 64.0 if is_left else 72.0
                    for i in range(step_len):
                        if start_s + i >= total_samples: break
                        t = i / sample_rate
                        # Low thud impact of heel
                        thud = math.sin(2.0 * math.pi * base_f * t) * math.exp(-24.0 * t)
                        # Shoe sole scuff / friction crunch
                        scuff = random.uniform(-0.4, 0.4) * math.exp(-32.0 * t)
                        val = (thud * 0.75 + scuff * 0.35)
                        samples[start_s + i] += val

            # 4. DOOR CREAK / STICK-SLIP FRICTION
            elif any(w in prompt_lower for w in ["двер", "скрип", "creak", "hinge"]):
                for i in range(total_samples):
                    t = i / sample_rate
                    prog = t / duration_sec
                    f = 460.0 + 320.0 * math.sin(2.0 * math.pi * 3.8 * t) + 100.0 * random.uniform(-1, 1)
                    val = math.sin(2.0 * math.pi * f * t) + 0.35 * math.sin(4.0 * math.pi * f * t)
                    env = math.sin(math.pi * prog) ** 0.85
                    samples[i] = val * env * 0.65

            # 5. RAIN / WATER / WEATHER
            elif any(w in prompt_lower for w in ["rain", "дожд", "вода", "капл", "water", "река", "ливень", "шторм"]):
                b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0
                for i in range(total_samples):
                    white = random.uniform(-1.0, 1.0)
                    b0 = 0.99886 * b0 + white * 0.0555179
                    b1 = 0.99332 * b1 + white * 0.0750759
                    b2 = 0.96900 * b2 + white * 0.1538520
                    b3 = 0.86650 * b3 + white * 0.3104856
                    b4 = 0.55000 * b4 + white * 0.5329522
                    b5 = -0.7616 * b5 - white * 0.0168980
                    pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
                    b6 = white * 0.115926
                    samples[i] = pink * 0.10

            # 6. LASER / SCI-FI BLASTER
            elif any(w in prompt_lower for w in ["laser", "blaster", "лазер", "бластер", "выстрел"]):
                for i in range(total_samples):
                    t = i / sample_rate
                    freq = 2600.0 * math.exp(-7.0 * t) + 140.0
                    decay = math.exp(-3.8 * t)
                    samples[i] = math.sin(2.0 * math.pi * freq * t) * decay * 0.75

            # 7. BELL / CHIME / NOTIFICATION
            elif any(w in prompt_lower for w in ["chime", "колокол", "колокольчик", "уведомление", "notify", "bell"]):
                freqs = [523.25, 659.25, 783.99, 1046.50]
                for i in range(total_samples):
                    t = i / sample_rate
                    val = 0.0
                    decay = math.exp(-1.8 * t)
                    for idx, f in enumerate(freqs):
                        val += (0.4 / (idx + 1)) * math.sin(2.0 * math.pi * f * t)
                    samples[i] = val * decay * 0.75

            # 8. DEFAULT: FOLEY TEXTURE
            else:
                for i in range(total_samples):
                    t = i / sample_rate
                    decay = math.exp(-1.0 * t)
                    samples[i] = math.sin(2.0 * math.pi * 320.0 * t) * decay * 0.4

            self._write_pcm_wav(samples, target, sample_rate)
            elapsed = round(time.time() - t0, 2)
            return {
                "success": True,
                "type": "sound",
                "file_path": str(target),
                "url": f"/static/generated/audio/{target.name}",
                "prompt": prompt,
                "duration_sec": elapsed,
                "engine": "Acoustic / Foley Synthesizer (Field Simulation)"
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
        finally:
            self.is_busy = False
