"""Transcribe audio clips locally (faster-whisper) to verify each clip says what its key expects.

usage: python3 tools/voice/transcribe.py file1.mp3 [file2.mp3 ...]
"""
import subprocess, sys
import numpy as np
from faster_whisper import WhisperModel

def pcm(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', '16000', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0

model = WhisperModel('base.en', device='cpu', compute_type='int8')
for f in sys.argv[1:]:
    segs, _ = model.transcribe(pcm(f), word_timestamps=True)
    for s in segs:
        if len(sys.argv) == 2:
            for w in s.words: print(f'{w.start:6.2f}-{w.end:6.2f} {w.word}')
        else:
            print(f, '|', s.text.strip())
