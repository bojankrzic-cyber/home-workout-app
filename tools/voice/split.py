"""Split one recorded take into per-phrase clips, verified by speech recognition.

usage: python3 tools/voice/split.py take.mp3 clips.json out_dir
       clips.json = [[key, text], ...] in the order they were read in the take

The take is cut at every pause (ffmpeg silencedetect), each piece is transcribed locally
(faster-whisper), and consecutive pieces are grouped greedily so each group's transcript
best matches the expected phrase. Sentence pauses inside a phrase ("Great job. Workout
complete.") therefore stay in one clip. Prints the match score per clip; exits non-zero if
any clip scores below 0.6 so a bad take is never shipped silently.
"""
import difflib, json, re, subprocess, sys
import numpy as np
from faster_whisper import WhisperModel

SR = 16000
ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split()
TENS = 'twenty thirty forty fifty sixty seventy eighty ninety'.split()

def words(n):
    # integer -> English words, so '21' (whisper) and 'twenty-one' (script) compare equal
    if n < 20: return ONES[n]
    if n < 100: return TENS[n // 10 - 2] + (' ' + ONES[n % 10] if n % 10 else '')
    if n < 1000: return ONES[n // 100] + ' hundred' + (' ' + words(n % 100) if n % 100 else '')
    return words(n // 1000) + ' thousand' + (' ' + words(n % 1000) if n % 1000 else '')

def num(m):
    d = m.group(0)
    lead = len(d) - len(d.lstrip('0'))
    return ' '.join(['oh'] * lead + ([words(int(d))] if d.lstrip('0') else []))

def norm(t):
    t = t.lower().replace('-', ' ').replace('%', ' percent')
    t = re.sub(r'\d+', num, t.replace(',', ''))
    t = re.sub(r'\b(o|zero)\b', 'oh', t)
    t = re.sub(r'metres?\b', lambda m: 'meter' + ('s' if m.group(0).endswith('s') else ''), t)
    t = re.sub(r'kms?\b', 'kilometers', t)
    return re.sub(r'[^a-z ]', '', re.sub(r'\s+', ' ', t)).strip()

def pcm(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0

def pieces(path, d=0.2):
    err = subprocess.run(['ffmpeg', '-hide_banner', '-i', path, '-af', f'silencedetect=noise=-40dB:d={d}', '-f', 'null', '-'], capture_output=True, text=True).stderr
    h, m, s = re.search(r'Duration: (\d+):(\d+):([\d.]+)', err).groups()
    dur = int(h) * 3600 + int(m) * 60 + float(s)
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', err)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', err)]
    out, t = [], 0.0
    for a, b in zip(starts, ends + [dur]):
        if a - t > 0.08: out.append((t, a))
        t = b
    if dur - t > 0.08: out.append((t, dur))
    return out

def main(src, clips, outdir):
    clips = json.load(open(clips))
    model = WhisperModel('base.en', device='cpu', compute_type='int8')
    audio = pcm(src)
    segs = pieces(src)
    texts = []
    for a, b in segs:
        part = audio[int(max(0, a - 0.05) * SR):int((b + 0.05) * SR)]
        texts.append(' '.join(s.text for s in model.transcribe(part, language='en')[0]))
    j, bad = 0, 0
    for key, want in clips:
        best = (-1, 1)
        for k in range(1, 6):
            if j + k > len(segs): break
            got = norm(' '.join(texts[j:j + k]))
            score = difflib.SequenceMatcher(None, got, norm(want)).ratio()
            if score > best[0]: best = (score, k)
        score, k = best
        a, b = segs[j][0], segs[j + k - 1][1]
        heard = ' '.join(texts[j:j + k]).strip()
        j += k
        a, b = max(0, a - 0.06), b + 0.12
        subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-ss', f'{a:.3f}', '-to', f'{b:.3f}',
                        '-ac', '1', '-ar', '44100', '-b:a', '64k', f'{outdir}/{key}.mp3'], check=True)
        flag = '' if score >= 0.6 else '   <-- CHECK'
        bad += score < 0.6
        print(f'{key:24s} {score:.2f}  "{heard}"{flag}')
    if j != len(segs): print(f'warning: {len(segs) - j} trailing piece(s) unused')
    sys.exit(1 if bad else 0)

if __name__ == '__main__':
    main(*sys.argv[1:4])
