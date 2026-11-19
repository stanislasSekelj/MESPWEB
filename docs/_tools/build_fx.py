"""Build web-optimised copies of the app's effects into website/assets/fx/.

Run from the repo root with a Python that has Pillow:
    python website/_tools/build_fx.py
Each animated WebP is scaled down and re-encoded until it is <= 600 KB.
Looping effects (fire, smoke) are shortened to a few seconds; the cut is
cross-faded so the shorter loop stays seamless. One-shot effects keep every frame.
A poster (frame chosen to be well developed) is written next to it.
"""
import glob, io, os, struct, sys
from PIL import Image

OUT = 'website/assets/fx'
LIMIT = 600 * 1024
# (max side px, quality, frame step) tried in order until the file fits
LADDER = [(340, 52, 1), (320, 46, 1), (300, 40, 1), (280, 34, 1), (260, 28, 1), (240, 24, 1)]
LOOP_FRAMES = {'fire': 45, 'smoke': 60}   # at 15 fps: 3 s and 4 s
FADE = 10
NAMES = {
    'Loopable_Burning_Body_1': 'fire-body', 'Loopable_Door_Fire_4': 'fire-door-1',
    'Loopable_Door_Fire_9': 'fire-door-2', 'Loopable_Ground_Fire_54': 'fire-ground-1',
    'Loopable_Ground_Fire_60': 'fire-ground-2', 'Loopable_Window_Fire_15': 'fire-window-1',
    'Loopable_Window_Fire_16': 'fire-window-2', 'Looping_Smoke_Plume_Windy_2': 'smoke-1',
    'Looping_Smoke_Plume_Windy_5': 'smoke-2', 'Looping_Smoke_Plume_Windy_6': 'smoke-3',
    'Super_Lightning_Ground_With_Sparks_29': 'lightning-1', 'Super_Lightning_Ground_With_Sparks_30': 'lightning-2',
    'Ultimate_Explosion_41_Aerial': 'explosion-aerial', 'Ultimate_Explosion_47_Night': 'explosion-night',
}

def durations(path):
    b = open(path, 'rb').read(); p = 12; out = []
    while p < len(b):
        cc = b[p:p+4]; n = struct.unpack('<I', b[p+4:p+8])[0]
        if cc == b'ANMF': out.append(int.from_bytes(b[p+20:p+23], 'little'))
        p += 8 + n + (n & 1)
    return out

def main():
    only = sys.argv[1:]
    for src in sorted(glob.glob('output/*/*/*.webp')):
        base = os.path.basename(src)[:-5]
        if base not in NAMES or (only and NAMES[base] not in only): continue
        name = NAMES[base]
        im = Image.open(src); d = durations(src)
        frames = []
        for k in range(im.n_frames):
            im.seek(k); frames.append(im.convert('RGBA'))
        # poster: the most opaque frame, so no effect has a blank or sparse still
        keep = LOOP_FRAMES.get(name.split('-')[0])
        if keep and len(frames) >= keep + FADE:
            frames = [Image.blend(frames[keep + i], frames[i], i / FADE) if i < FADE else frames[i] for i in range(keep)]
        cover = [f.getchannel('A').resize((32, 32)).histogram()[128:] for f in frames]
        pk = max(range(len(frames)), key=lambda i: sum(cover[i]))
        for side, q, step in LADDER:
            w, h = im.size; s = side / max(w, h)
            size = (round(w * s), round(h * s))
            fr = [f.resize(size, Image.LANCZOS) for f in frames[::step]]
            buf = io.BytesIO()
            fr[0].save(buf, 'WEBP', save_all=True, append_images=fr[1:], duration=d[0] * step,
                       loop=0, quality=q, method=4, minimize_size=True, alpha_quality=60)
            if buf.tell() <= LIMIT: break
        open(f'{OUT}/{name}.webp', 'wb').write(buf.getvalue())
        frames[pk].resize(size, Image.LANCZOS).save(f'{OUT}/{name}.poster.webp', 'WEBP', quality=60, method=6)
        print(f'{name:18s} {size[0]}x{size[1]} q{q} step{step} {len(fr)}f {buf.tell()/1024:.0f} KB  poster {os.path.getsize(f"{OUT}/{name}.poster.webp")/1024:.0f} KB', flush=True)

main()
