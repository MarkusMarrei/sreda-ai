"""MusicGen Small ONNX Inference Engine for SREDA AI.
Generates genuine musical compositions and instrumentals on CPU using quantized 24-layer ONNX models.
"""

import os
import json
import time
import wave
import struct
import logging
from pathlib import Path
import numpy as np
import onnxruntime as ort
from transformers import AutoTokenizer

logger = logging.getLogger("sreda.musicgen")

class MusicGenService:
    def __init__(self, models_dir: Path):
        self.models_dir = Path(models_dir)
        self.tokenizer = None
        self.text_sess = None
        self.dec_sess = None
        self.enc_sess = None
        self.num_layers = 24
        self.num_heads = 16
        self.head_dim = 64
        self.d_model = 1024
        self.text_dim = 768
        self._is_ready = False
        self._load_error = None

    def _ensure_loaded(self):
        """Lazy-load ONNX sessions and tokenizer."""
        if self._is_ready:
            return True
        if self._load_error:
            return False

        try:
            t0 = time.time()
            logger.info("Initializing MusicGen Small ONNX sessions...")

            # Load HuggingFace T5 tokenizer from models_dir
            self.tokenizer = AutoTokenizer.from_pretrained(str(self.models_dir))

            # Read config to get exact layer parameters if present
            cfg_path = self.models_dir / "config.json"
            if cfg_path.exists():
                with open(cfg_path, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    dec_cfg = cfg.get("decoder", {})
                    self.num_layers = dec_cfg.get("num_hidden_layers", 24)
                    self.num_heads = dec_cfg.get("num_attention_heads", 16)
                    self.d_model = dec_cfg.get("hidden_size", 1024)
                    self.head_dim = self.d_model // self.num_heads
                    self.text_dim = cfg.get("text_encoder", {}).get("d_model", 768)

            # Thread settings for high-performance CPU execution
            opts = ort.SessionOptions()
            opts.intra_op_num_threads = min(8, os.cpu_count() or 4)
            opts.inter_op_num_threads = 2
            opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

            text_path = self.models_dir / "text_encoder_quantized.onnx"
            dec_path = self.models_dir / "decoder_model_merged_quantized.onnx"
            enc_path = self.models_dir / "encodec_decode_quantized.onnx"

            if not (text_path.exists() and dec_path.exists() and enc_path.exists()):
                raise FileNotFoundError(f"Missing ONNX model files in {self.models_dir}")

            self.text_sess = ort.InferenceSession(str(text_path), sess_options=opts, providers=["CPUExecutionProvider"])
            self.dec_sess = ort.InferenceSession(str(dec_path), sess_options=opts, providers=["CPUExecutionProvider"])
            self.enc_sess = ort.InferenceSession(str(enc_path), sess_options=opts, providers=["CPUExecutionProvider"])

            self._is_ready = True
            logger.info(f"MusicGen Small loaded successfully ({self.num_layers} layers) in {time.time() - t0:.2f}s")
            return True
        except Exception as e:
            logger.error(f"Failed to load MusicGen Small: {e}", exc_info=True)
            self._load_error = str(e)
            return False

    def enhance_prompt(self, prompt: str) -> str:
        """Map Russian or brief musical requests into expressive English conditioning."""
        p_low = prompt.lower()
        instruments = []

        # Instrument mapping
        if any(w in p_low for w in ["гитар", "guitar", "струн"]):
            if any(w in p_low for w in ["электро", "рок", "перегруз", "соло"]):
                instruments.append("electric guitar solo, distortion, expressive rock riffs")
            else:
                instruments.append("warm acoustic guitar fingerpicking, natural resonance, peaceful melody")
        if any(w in p_low for w in ["скрипк", "violin", "скрипичн", "смычк"]):
            instruments.append("expressive solo violin, gentle vibrato, romantic classical timbre")
        if any(w in p_low for w in ["виолончел", "cello"]):
            instruments.append("warm cello solo melody, deep sustained strings")
        if any(w in p_low for w in ["пианино", "фортепиано", "рояль", "клавиш", "piano"]):
            instruments.append("grand piano melody, emotional chords, rich acoustics")
        if any(w in p_low for w in ["саксофон", "sax"]):
            instruments.append("smooth jazz saxophone, soulful, velvet tone")
        if any(w in p_low for w in ["флейт", "flute"]):
            instruments.append("gentle wooden flute melody, soothing breath")
        if any(w in p_low for w in ["барабан", "ударные", "drums", "бит"]):
            instruments.append("acoustic drums rhythm, steady groove, crisp percussion")
        if any(w in p_low for w in ["джаз", "jazz"]):
            instruments.append("smooth lounge jazz, upright bass, brushed drums, warm piano")
        if any(w in p_low for w in ["рок", "rock"]):
            instruments.append("classic rock anthem, energetic tempo, overdrive guitar")
        if any(w in p_low for w in ["лоуфай", "lofi", "lo-fi", "chill"]):
            instruments.append("chill lofi hip hop beat, mellow vinyl chords, relaxed vibe")
        if any(w in p_low for w in ["электрон", "synth", "синт", "edm"]):
            instruments.append("synthesizer arpeggio, ambient electronic soundscape")
        if any(w in p_low for w in ["оркестр", "кино", "soundtrack", "epic"]):
            instruments.append("cinematic orchestral strings, epic harmony, film score")

        if instruments:
            core = ", ".join(instruments)
            return f"{core}, melodious musical composition, rich overtone acoustic timbre, high quality studio audio"

        # If user wrote in English or no special instrument matched, clean and qualify
        return f"{prompt}, musical instrumental composition, melodious, high audio fidelity"

    def generate_music(self, prompt: str, duration_sec: float = 5.0, temp: float = 0.85, top_k: int = 250) -> np.ndarray | None:
        """Generate waveform samples (float32 array, 32000 Hz) using MusicGen Small (24 layers)."""
        if not self._ensure_loaded():
            return None

        enhanced = self.enhance_prompt(prompt)
        logger.info(f"Generating music for prompt: '{prompt}' -> '{enhanced}' ({duration_sec}s)")

        # 1. Text tokenization & encoding
        tok_out = self.tokenizer([enhanced], return_tensors="np")
        input_ids = tok_out["input_ids"].astype(np.int64)
        attention_mask = tok_out["attention_mask"].astype(np.int64)

        text_out = self.text_sess.run(None, {
            "input_ids": input_ids,
            "attention_mask": attention_mask
        })
        encoder_hidden_states = text_out[0]
        encoder_attention_mask = attention_mask

        # Calculate frames (50 frames per second, quantized to chunks of 16 frames)
        raw_frames = int(duration_sec * 50)
        num_chunks = max(2, int(np.ceil(raw_frames / 16.0)))
        total_frames = num_chunks * 16

        num_codebooks = 4

        # Step 0: prompt conditioning and KV cache init for all 24 layers
        feed0 = {
            "encoder_attention_mask": encoder_attention_mask,
            "input_ids": np.full((num_codebooks, 1), 2048, dtype=np.int64),
            "encoder_hidden_states": encoder_hidden_states,
            "use_cache_branch": np.array([False], dtype=bool),
        }
        for l in range(self.num_layers):
            feed0[f"past_key_values.{l}.decoder.key"] = np.zeros((1, self.num_heads, 0, self.head_dim), dtype=np.float32)
            feed0[f"past_key_values.{l}.decoder.value"] = np.zeros((1, self.num_heads, 0, self.head_dim), dtype=np.float32)
            feed0[f"past_key_values.{l}.encoder.key"] = np.zeros((1, self.num_heads, 0, self.head_dim), dtype=np.float32)
            feed0[f"past_key_values.{l}.encoder.value"] = np.zeros((1, self.num_heads, 0, self.head_dim), dtype=np.float32)

        outs0 = self.dec_sess.run(None, feed0)

        # Unpack KV caches from Step 0
        dec_keys = []
        dec_vals = []
        enc_keys = []
        enc_vals = []
        for l in range(self.num_layers):
            base_idx = 1 + 4 * l
            dec_keys.append(outs0[base_idx])
            dec_vals.append(outs0[base_idx + 1])
            enc_keys.append(outs0[base_idx + 2])
            enc_vals.append(outs0[base_idx + 3])

        empty_enc_states = np.zeros((1, 0, self.text_dim), dtype=np.float32)

        def sample_tokens(logits):
            sampled = np.zeros((num_codebooks, 1), dtype=np.int64)
            for cb in range(num_codebooks):
                cb_logits = logits[cb, 0, :2048] / temp
                if top_k > 0:
                    top_k_indices = np.argpartition(cb_logits, -top_k)[-top_k:]
                    mask = np.ones_like(cb_logits, dtype=bool)
                    mask[top_k_indices] = False
                    cb_logits[mask] = -1e9
                probs = np.exp(cb_logits - np.max(cb_logits))
                probs = probs / np.sum(probs)
                sampled[cb, 0] = np.random.choice(len(probs), p=probs)
            return sampled

        all_tokens = []
        curr_token = sample_tokens(outs0[0])
        all_tokens.append(curr_token[:, 0])

        # Autoregressive generation loop with KV-cache across all layers
        for step in range(1, total_frames):
            feed = {
                "encoder_attention_mask": encoder_attention_mask,
                "input_ids": curr_token,
                "encoder_hidden_states": empty_enc_states,
                "use_cache_branch": np.array([True], dtype=bool),
            }
            for l in range(self.num_layers):
                feed[f"past_key_values.{l}.decoder.key"] = dec_keys[l]
                feed[f"past_key_values.{l}.decoder.value"] = dec_vals[l]
                feed[f"past_key_values.{l}.encoder.key"] = enc_keys[l]
                feed[f"past_key_values.{l}.encoder.value"] = enc_vals[l]

            outs = self.dec_sess.run(None, feed)

            for l in range(self.num_layers):
                base_idx = 1 + 4 * l
                dec_keys[l] = outs[base_idx]
                dec_vals[l] = outs[base_idx + 1]

            curr_token = sample_tokens(outs[0])
            all_tokens.append(curr_token[:, 0])

        # Stack into codes: (4, total_frames)
        codes = np.stack(all_tokens, axis=1)

        # Batch into 16-frame chunks for Encodec decode
        chunks = [codes[:, c * 16:(c + 1) * 16] for c in range(num_chunks)]
        batched_chunks = np.stack(chunks, axis=0)[np.newaxis, :, :, :]  # (1, num_chunks, 4, 16)

        # Encodec decode to audio waveform
        wav_out = self.enc_sess.run(None, {"audio_codes": batched_chunks.astype(np.int64)})[0]
        flattened = wav_out.reshape(-1)

        # Normalize waveform
        peak = np.max(np.abs(flattened))
        if peak > 0:
            flattened = flattened / max(peak, 1.0)

        return flattened

    def save_wav(self, audio_data: np.ndarray, output_path: Path, sample_rate: int = 32000):
        """Save normalized float32 waveform to 16-bit PCM WAV."""
        output_path.parent.mkdir(parents=True, exist_ok=True)
        pcm = (np.clip(audio_data, -1.0, 1.0) * 32767.0).astype(np.int16)
        with wave.open(str(output_path), "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(pcm.tobytes())
