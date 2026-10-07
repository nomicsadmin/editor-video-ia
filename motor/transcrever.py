#!/usr/bin/env python3
"""
Transcrição local, palavra a palavra, sem mandar o áudio para nenhum servidor.
  Mac com chip Apple (M1 em diante): MLX Whisper (rápido, usa a GPU).
  Windows e Mac Intel: faster-whisper (usa a placa de vídeo NVIDIA se tiver; senão o processador, mais devagar).

Uso:  <python do projeto> motor/transcrever.py <video-ou-audio> <saida_base>
Gera <saida_base>.json (segmentos + palavras com tempo), .txt e .srt.
"""
import json
import os
import subprocess
import sys
import tempfile

MODELO_MLX = "mlx-community/whisper-" + os.environ.get("EDITOR_MODELO", "large-v3-turbo")  # EDITOR_MODELO=tiny no teste automático
MODELO_FW = os.environ.get("EDITOR_MODELO", "large-v3-turbo")
IDIOMA = os.environ.get("EDITOR_IDIOMA", "pt")
IDIOMA = None if IDIOMA == "auto" else IDIOMA  # "auto" = descobre a língua (referência gringa)


def hhmmss(s, sep=","):
    ms = int(round((s - int(s)) * 1000)); s = int(s)
    return f"{s // 3600:02d}:{(s % 3600) // 60:02d}:{s % 60:02d}{sep}{ms:03d}"


def extrair_audio(caminho):
    if caminho.lower().endswith(".wav"):
        return caminho
    destino = os.path.join(tempfile.gettempdir(), os.path.basename(caminho) + ".16k.wav")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", caminho, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", destino],
                   check=True)
    return destino


def com_mlx(audio):
    import mlx_whisper
    return mlx_whisper.transcribe(audio, path_or_hf_repo=MODELO_MLX, language=IDIOMA, word_timestamps=True,
                                  condition_on_previous_text=False, verbose=False)


def com_faster_whisper(audio):
    from faster_whisper import WhisperModel
    try:  # placa de vídeo NVIDIA, se houver; senão o processador
        m = WhisperModel(MODELO_FW, device="cuda", compute_type="float16")
    except Exception:
        m = WhisperModel(MODELO_FW, device="cpu", compute_type="int8")
    segs, _ = m.transcribe(audio, language=IDIOMA, word_timestamps=True, condition_on_previous_text=False)
    out = {"text": "", "segments": []}
    for s in segs:
        out["segments"].append({"start": s.start, "end": s.end, "text": s.text,
                                "words": [{"word": w.word, "start": w.start, "end": w.end} for w in (s.words or [])]})
        out["text"] += s.text
    return out


def main():
    entrada, base = sys.argv[1], sys.argv[2]
    audio = extrair_audio(entrada)
    try:
        r = com_mlx(audio)
    except Exception:  # sem chip Apple, ou Mac sem acesso à GPU: faster-whisper
        r = com_faster_whisper(audio)
    json.dump(r, open(base + ".json", "w"), ensure_ascii=False, indent=1)
    open(base + ".txt", "w").write(r["text"].strip() + "\n")
    with open(base + ".srt", "w") as f:
        for i, s in enumerate(r["segments"], 1):
            f.write(f"{i}\n{hhmmss(s['start'])} --> {hhmmss(s['end'])}\n{s['text'].strip()}\n\n")


if __name__ == "__main__":
    main()
