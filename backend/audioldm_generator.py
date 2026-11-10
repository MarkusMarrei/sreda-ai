import sys
import argparse
import time
from pathlib import Path
import torch
import scipy.io.wavfile
from diffusers import AudioLDMPipeline

def main():
    parser = argparse.ArgumentParser(description="AudioLDM Foley Generator")
    parser.add_argument("--prompt", type=str, required=True, help="Text description of sound")
    parser.add_argument("--output", type=str, required=True, help="Output WAV path")
    parser.add_argument("--duration", type=float, default=3.0, help="Duration in seconds")
    parser.add_argument("--steps", type=int, default=15, help="Inference steps")
    args = parser.parse_args()

    t0 = time.time()
    repo_id = "cvssp/audioldm-s-full-v2"
    pipe = AudioLDMPipeline.from_pretrained(repo_id, torch_dtype=torch.float32)
    pipe = pipe.to("cpu")
    load_time = time.time() - t0

    t1 = time.time()
    audio = pipe(
        args.prompt,
        num_inference_steps=args.steps,
        audio_length_in_s=args.duration,
        guidance_scale=2.5
    ).audios[0]
    gen_time = time.time() - t1

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    scipy.io.wavfile.write(str(out_path), rate=16000, data=audio)
    total_time = time.time() - t0
    print(f"SUCCESS: Generated in {total_time:.2f}s (load: {load_time:.2f}s, gen: {gen_time:.2f}s) -> {out_path}")

if __name__ == "__main__":
    main()
