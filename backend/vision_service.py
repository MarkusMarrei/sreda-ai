import os
import json
import time
from pathlib import Path
from PIL import Image
import numpy as np
import onnxruntime as ort

class VisionService:
    def __init__(self, base_dir: Path = None):
        if base_dir is None:
            base_dir = Path(__file__).resolve().parent.parent
        self.base_dir = Path(base_dir)

        self.models_dir = self.base_dir / "models" / "vision"
        self.models_dir.mkdir(parents=True, exist_ok=True)

        user_profile = os.environ.get("USERPROFILE", "C:\\Users\\Public")
        self.uploads_dir = Path(user_profile) / "SredaAI" / "generated" / "uploads"
        self.uploads_dir.mkdir(parents=True, exist_ok=True)

        self.encoder_sess = None
        self.decoder_sess = None
        self.id2token = None
        self.bos_token = 50256
        self.eos_token = 50256

    def _ensure_models_loaded(self):
        """Lazy-load neural vision models on first request."""
        if self.encoder_sess is not None and self.decoder_sess is not None:
            return True

        enc_path = self.models_dir / 'vit_encoder_quantized.onnx'
        dec_path = self.models_dir / 'gpt2_decoder_quantized.onnx'
        vocab_path = self.models_dir / 'vocab.json'

        if not enc_path.exists() or not dec_path.exists() or not vocab_path.exists():
            return False

        try:
            with open(vocab_path, 'r', encoding='utf-8') as f:
                vocab = json.load(f)
            self.id2token = {v: k for k, v in vocab.items()}

            sess_options = ort.SessionOptions()
            sess_options.intra_op_num_threads = 4
            self.encoder_sess = ort.InferenceSession(str(enc_path), sess_options, providers=['CPUExecutionProvider'])
            self.decoder_sess = ort.InferenceSession(str(dec_path), sess_options, providers=['CPUExecutionProvider'])
            return True
        except Exception as e:
            print(f"[VisionService] Error loading ONNX sessions: {e}")
            return False

    def caption_image(self, img: Image.Image) -> str:
        """Run neural image captioning using quantized ViT-GPT2."""
        if not self._ensure_models_loaded():
            return ""

        try:
            rgb_img = img.convert('RGB').resize((224, 224), Image.Resampling.BILINEAR)
            arr = np.array(rgb_img, dtype=np.float32) / 255.0

            # Normalize ImageNet mean/std
            mean = np.array([0.5, 0.5, 0.5], dtype=np.float32)
            std = np.array([0.5, 0.5, 0.5], dtype=np.float32)
            arr = (arr - mean) / std
            pixel_values = np.transpose(arr, (2, 0, 1))[np.newaxis, ...]

            # Vision encoder
            encoder_outputs = self.encoder_sess.run(None, {'pixel_values': pixel_values})
            encoder_hidden_states = encoder_outputs[0]

            # Autoregressive text generation
            cur_tokens = [self.bos_token]
            for _ in range(25):
                input_ids = np.array([cur_tokens], dtype=np.int64)
                outputs = self.decoder_sess.run(None, {
                    'input_ids': input_ids,
                    'encoder_hidden_states': encoder_hidden_states
                })
                logits = outputs[0]
                next_token = int(np.argmax(logits[0, -1, :]))
                if next_token == self.eos_token:
                    break
                cur_tokens.append(next_token)

            caption = ''.join([self.id2token.get(t, '') for t in cur_tokens[1:]]).replace('Ġ', ' ').strip()
            return caption
        except Exception as e:
            print(f"[VisionService] Captioning inference error: {e}")
            return ""

    def analyze_image(self, file_path: Path | str) -> dict:
        file_path = Path(file_path)
        if not file_path.exists():
            return {"success": False, "error": "Файл изображения не найден"}

        t0 = time.time()
        try:
            with Image.open(file_path) as img:
                width, height = img.size
                format_name = img.format or "IMAGE"

                # Run Neural Vision Captioner
                neural_caption = self.caption_image(img)

                # Basic color/light dynamics
                rgb_img = img.convert('RGB')
                np_arr = np.array(rgb_img)
                mean_brightness = float(np.mean(np_arr))
                contrast = float(np.std(np_arr))

                small_img = rgb_img.resize((50, 50))
                small_arr = np.array(small_img).reshape(-1, 3)
                avg_color = np.mean(small_arr, axis=0).astype(int)
                hex_color = f"#{avg_color[0]:02x}{avg_color[1]:02x}{avg_color[2]:02x}"

                brightness_desc = (
                    "тёмное / ночное" if mean_brightness < 70 else
                    "светлое / дневное" if mean_brightness > 180 else "умеренная освещенность"
                )

                elapsed = round(time.time() - t0, 2)
                return {
                    "success": True,
                    "type": "image",
                    "file_path": str(file_path),
                    "filename": file_path.name,
                    "width": width,
                    "height": height,
                    "aspect_ratio": f"{width}:{height}",
                    "format": format_name,
                    "dominant_hex": hex_color,
                    "brightness": brightness_desc,
                    "neural_caption": neural_caption,
                    "duration_sec": elapsed
                }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def format_vision_context_for_prompt(self, analysis: dict) -> str:
        if not analysis.get("success"):
            return ""

        filename = analysis.get('filename')
        caption = analysis.get('neural_caption', '').strip()
        dims = f"{analysis.get('width')}x{analysis.get('height')} px"
        lighting = analysis.get('brightness', 'естественная')

        lines = [
            f"\n\n[ВИЗУАЛЬНЫЙ АНАЛИЗ ПРИКРЕПЛЁННОГО ИЗОБРАЖЕНИЯ {filename}]:",
            f"- Разрешение: {dims}, освещение: {lighting}",
        ]
        if caption:
            lines.append(f"- РАСПОЗНАННЫЕ ОБЪЕКТЫ И СЦЕНА (нейросеть зрения): \"{caption}\"")
        lines.append(
            "[ИНСТРУКЦИЯ К ИЗОБРАЖЕНИЮ]: Внимательно используй распознанные визуальные объекты "
            "выше для ответа на вопросы пользователя о том, кто или что изображено на картинке."
        )
        return "\n".join(lines) + "\n"
