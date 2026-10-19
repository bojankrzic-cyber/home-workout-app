"""Pack the clip lists into TTS takes of <= 480 characters (eleven_v3, phrases separated by [pause 1s]).

usage: python3 tools/voice/make_takes.py out_dir [skip_dir]
       writes out_dir/<list>_<nn>.txt (text to record) + .json (clip list for split.py);
       keys already present as skip_dir/<key>.mp3 are left out (resume).
"""
import json, os, sys

D = os.path.dirname(os.path.abspath(__file__))
SEP, MAX = ' [pause 1s] ', 480

def spoken(t):
    t = t.strip()
    t = t[0].upper() + t[1:]
    return t if t[-1] in '.!?' else t + '.'

def main(out, skip=None):
    os.makedirs(out, exist_ok=True)
    done = {f[:-4] for f in os.listdir(skip)} if skip and os.path.isdir(skip) else set()
    for name in ('trail', 'names', 'cues', 'motivation'):
        clips = [c for c in json.load(open(f'{D}/clips_{name}.json')) if c[0] not in done]
        takes, cur = [], []
        for c in clips:
            if cur and len(SEP.join(spoken(t) for _, t in cur + [c])) > MAX: takes.append(cur); cur = []
            cur.append(c)
        if cur: takes.append(cur)
        for i, t in enumerate(takes):
            base = f'{out}/{name}_{i:02d}'
            open(base + '.txt', 'w').write(SEP.join(spoken(x) for _, x in t))
            json.dump(t, open(base + '.json', 'w'), ensure_ascii=False)
            print(base, len(t), 'clips', len(open(base + '.txt').read()), 'chars')

if __name__ == '__main__':
    main(*sys.argv[1:3])
