#!/usr/bin/env python3
"""Generate vintage-looking placeholder photographs for the three demo cartridges."""

from __future__ import annotations

import io
import math
import random
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1] / "public" / "photos"

REMOTE: dict[str, list[tuple[str, bool]]] = {
    "thailand": [
        ("https://images.unsplash.com/photo-1528183429752-a97d0bf99b5a?auto=format&fit=crop&w=1600&q=75", False),
        ("https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=1600&q=75", False),
        ("https://images.unsplash.com/photo-1506665531195-3566af2b4dfa?auto=format&fit=crop&w=1200&q=75", True),
        ("https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1600&q=75", False),
        ("https://images.unsplash.com/photo-1483683804023-6ccdb62f86ef?auto=format&fit=crop&w=1600&q=75", False),
        ("https://images.unsplash.com/photo-1519451241324-20b4ea2c4220?auto=format&fit=crop&w=1600&q=75", False),
        ("https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1600&q=75", False),
        ("https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=1600&q=75", False),
    ],
    "sf": [
        ("https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=1600&q=75", False),
        ("https://images.unsplash.com/photo-1449034446853-66c86144b0ad?auto=format&fit=crop&w=1600&q=75", False),
        ("https://images.unsplash.com/photo-1534051767582-40af8f1cdd92?auto=format&fit=crop&w=1600&q=75", False),
        ("https://images.unsplash.com/photo-1506146332389-18117be98443?auto=format&fit=crop&w=1600&q=75", False),
        ("https://images.unsplash.com/photo-1521747116042-5a810fda9664?auto=format&fit=crop&w=1200&q=75", True),
        ("https://images.unsplash.com/photo-1414007650408-54b946c39e0f?auto=format&fit=crop&w=1600&q=75", False),
        ("https://images.unsplash.com/photo-1506146332389-18117be98443?auto=format&fit=crop&w=1600&q=75", False),
        ("https://images.unsplash.com/photo-1442570468985-f63ed5de9086?auto=format&fit=crop&w=1600&q=75", False),
    ],
    "nyc": [
        ("https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?auto=format&fit=crop&w=1600&q=75", False),
        ("https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=1600&q=75", False),
        ("https://images.unsplash.com/photo-1518391846015-55a9e71d294a?auto=format&fit=crop&w=1200&q=75", True),
        ("https://images.unsplash.com/photo-1449824913935-59a10b8d2000?auto=format&fit=crop&w=1600&q=75", False),
        ("https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?auto=format&fit=crop&w=1600&q=75", False),
        ("https://images.unsplash.com/photo-1543716091-a840c52bc38d?auto=format&fit=crop&w=1600&q=75", False),
        ("https://images.unsplash.com/photo-1534430480872-3498386e7856?auto=format&fit=crop&w=1600&q=75", False),
        ("https://images.unsplash.com/photo-1500916434205-0c28ffc5e1c0?auto=format&fit=crop&w=1600&q=75", False),
    ],
}

PALETTES = {
    "thailand": [
        ((255, 168, 76), (32, 92, 88), (196, 86, 42)),
        ((94, 196, 188), (245, 214, 150), (18, 78, 92)),
        ((48, 120, 64), (210, 186, 92), (24, 48, 28)),
        ((255, 122, 64), (64, 28, 48), (255, 206, 120)),
        ((212, 164, 64), (92, 48, 16), (255, 232, 176)),
        ((48, 96, 128), (240, 196, 120), (16, 40, 64)),
        ((120, 168, 72), (236, 220, 160), (48, 72, 32)),
        ((255, 140, 88), (80, 140, 168), (255, 220, 160)),
    ],
    "sf": [
        ((232, 120, 64), (96, 140, 168), (240, 220, 196)),
        ((176, 196, 204), (92, 108, 120), (232, 228, 220)),
        ((216, 92, 88), (92, 148, 176), (244, 212, 160)),
        ((64, 112, 148), (220, 200, 168), (32, 48, 64)),
        ((196, 156, 120), (120, 148, 164), (248, 236, 216)),
        ((255, 176, 96), (72, 96, 128), (255, 220, 176)),
        ((168, 124, 96), (72, 88, 104), (228, 208, 184)),
        ((80, 132, 164), (236, 164, 96), (32, 48, 72)),
    ],
    "nyc": [
        ((40, 48, 64), (212, 180, 96), (16, 16, 24)),
        ((232, 196, 64), (48, 52, 64), (180, 72, 48)),
        ((176, 92, 48), (212, 164, 88), (48, 64, 40)),
        ((128, 56, 48), (196, 168, 148), (32, 24, 24)),
        ((32, 32, 40), (255, 196, 72), (16, 16, 20)),
        ((64, 72, 80), (180, 188, 196), (24, 24, 28)),
        ((120, 64, 48), (216, 176, 136), (48, 32, 24)),
        ((24, 28, 48), (255, 168, 72), (12, 12, 20)),
    ],
}


def lerp(a: tuple[int, int, int], b: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))  # type: ignore[return-value]


def paint_scene(collection: str, index: int, portrait: bool) -> Image.Image:
    w, h = (1067, 1600) if portrait else (1600, 1067)
    sky, mid, ground = PALETTES[collection][index]
    img = Image.new("RGB", (w, h), sky)
    px = img.load()
    rng = random.Random(f"{collection}-{index}")

    horizon = int(h * (0.42 if not portrait else 0.55))
    for y in range(h):
        if y < horizon:
            t = y / max(horizon, 1)
            col = lerp(sky, mid, t * 0.65)
        else:
            t = (y - horizon) / max(h - horizon, 1)
            col = lerp(mid, ground, min(1, t * 1.1))
        for x in range(w):
            drift = math.sin(x * 0.004 + index) * 8
            px[x, y] = (
                max(0, min(255, col[0] + int(drift))),
                max(0, min(255, col[1] + int(drift * 0.4))),
                max(0, min(255, col[2] - int(drift * 0.2))),
            )

    draw = ImageDraw.Draw(img, "RGBA")

    # Sun / moon
    sx, sy = int(w * (0.7 - index * 0.04)), int(h * 0.22)
    r = int(min(w, h) * 0.08)
    for i in range(6, 0, -1):
        alpha = 28 * i
        draw.ellipse(
            [sx - r * i * 0.45, sy - r * i * 0.45, sx + r * i * 0.45, sy + r * i * 0.45],
            fill=(*mid, alpha),
        )
    draw.ellipse([sx - r, sy - r, sx + r, sy + r], fill=(*mid, 230))

    # Silhouettes
    if collection == "thailand":
        if index % 3 == 0:
            peak = [(int(w * 0.18), horizon + 20), (int(w * 0.32), int(h * 0.18)), (int(w * 0.46), horizon + 20)]
            draw.polygon(peak, fill=(*ground, 210))
            draw.rectangle([int(w * 0.31), int(h * 0.18), int(w * 0.33), horizon + 8], fill=(*ground, 210))
        for i in range(7):
            bx = int(w * (0.05 + i * 0.13))
            bw = int(w * 0.04)
            bh = int(h * (0.08 + rng.random() * 0.18))
            draw.polygon(
                [(bx, horizon + 40), (bx + bw // 2, horizon - bh), (bx + bw, horizon + 40)],
                fill=(*ground, 180),
            )
        draw.polygon(
            [(0, h), (0, int(h * 0.72)), (w, int(h * 0.8)), (w, h)],
            fill=(*ground, 160),
        )
    elif collection == "sf":
        y0 = horizon + 10
        pts = [(0, h)]
        x = 0
        while x <= w:
            pts.append((x, y0 - int(math.sin(x * 0.01 + index) * h * 0.08) - int(h * 0.04)))
            x += 40
        pts += [(w, h)]
        draw.polygon(pts, fill=(*ground, 170))
        # bridge cables
        if index % 2 == 0:
            draw.arc([int(w * 0.1), int(h * 0.2), int(w * 0.9), int(h * 0.85)], 200, 340, fill=(*mid, 200), width=6)
            for t in range(8):
                xx = int(w * (0.2 + t * 0.08))
                draw.line([(xx, int(h * 0.35)), (xx, horizon + 80)], fill=(*ground, 140), width=3)
    else:
        rng2 = random.Random(index + 20)
        for i in range(14):
            bw = int(w * (0.04 + rng2.random() * 0.08))
            bh = int(h * (0.16 + rng2.random() * 0.42))
            bx = int(w * (i / 14) + rng2.random() * 20)
            by = horizon + 30 - bh
            draw.rectangle([bx, by, bx + bw, horizon + 90], fill=(*ground, 200))
            # windows
            for wy in range(by + 12, horizon + 70, 18):
                for wx in range(bx + 6, bx + bw - 6, 12):
                    if rng2.random() > 0.45:
                        draw.rectangle([wx, wy, wx + 6, wy + 8], fill=(*mid, 180))

    img = img.filter(ImageFilter.GaussianBlur(radius=0.8))
    return img


def vintage(img: Image.Image, seed: int) -> Image.Image:
    rng = random.Random(seed)
    img = ImageEnhance.Color(img).enhance(0.78)
    img = ImageEnhance.Contrast(img).enhance(0.92)
    img = ImageOps.colorize(ImageOps.grayscale(img), black="#1c120c", white="#f3e6c8").convert("RGB")
    base = img
    # mix original back in so it doesn't go fully sepia
    orig = ImageEnhance.Color(ImageEnhance.Brightness(img.copy()).enhance(1.0)).enhance(1.0)
    # we already lost original; skip mix if we only have one
    img = Image.blend(base, orig, 0.35)

    overlay = Image.new("RGB", img.size, (255, 170, 90))
    img = Image.blend(img, overlay, 0.07)

    # vignette
    v = Image.new("L", img.size, 0)
    vd = ImageDraw.Draw(v)
    w, h = img.size
    vd.ellipse([-w * 0.05, -h * 0.08, w * 1.05, h * 1.08], fill=255)
    v = v.filter(ImageFilter.GaussianBlur(radius=min(w, h) * 0.18))
    img = Image.composite(img, ImageEnhance.Brightness(img).enhance(0.35), v)

    # grain
    grain = Image.new("RGB", img.size)
    gp = grain.load()
    for y in range(0, h, 2):
        for x in range(0, w, 2):
            n = rng.randint(0, 40)
            gp[x, y] = (n, n, n)
    grain = grain.resize(img.size, Image.Resampling.BILINEAR)
    img = Image.blend(img, grain, 0.08)

    # light leak
    leak = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(leak)
    if rng.random() > 0.3:
        ld.ellipse(
            [int(w * 0.55), -int(h * 0.2), int(w * 1.15), int(h * 0.45)],
            fill=(255, 140, 60, 50),
        )
        leak = leak.filter(ImageFilter.GaussianBlur(radius=80))
        img = Image.alpha_composite(img.convert("RGBA"), leak).convert("RGB")

    img = img.filter(ImageFilter.GaussianBlur(radius=0.45))
    return img


def vintage_photo(img: Image.Image, seed: int) -> Image.Image:
    rng = random.Random(seed)
    img = img.convert("RGB")
    img = ImageEnhance.Color(img).enhance(0.72)
    img = ImageEnhance.Contrast(img).enhance(0.94)
    img = ImageEnhance.Brightness(img).enhance(1.04)
    warm = Image.new("RGB", img.size, (255, 176, 96))
    img = Image.blend(img, warm, 0.1)

    w, h = img.size
    v = Image.new("L", img.size, 0)
    vd = ImageDraw.Draw(v)
    vd.ellipse([-w * 0.02, -h * 0.04, w * 1.02, h * 1.04], fill=255)
    v = v.filter(ImageFilter.GaussianBlur(radius=min(w, h) * 0.16))
    img = Image.composite(img, ImageEnhance.Brightness(img).enhance(0.42), v)

    grain = Image.effect_noise(img.size, 28).convert("RGB")
    img = Image.blend(img, grain, 0.07)
    if rng.random() > 0.4:
        leak = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(leak).ellipse(
            [int(w * 0.6), -int(h * 0.15), w + 80, int(h * 0.4)],
            fill=(255, 130, 50, 42),
        )
        leak = leak.filter(ImageFilter.GaussianBlur(80))
        img = Image.alpha_composite(img.convert("RGBA"), leak).convert("RGB")
    return img.filter(ImageFilter.GaussianBlur(0.4))


def fetch(url: str, portrait: bool) -> Image.Image | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "slide-projector-prototype/1.0"})
        with urllib.request.urlopen(req, timeout=8) as res:
            data = res.read()
        img = Image.open(io.BytesIO(data)).convert("RGB")
        target = (1067, 1600) if portrait else (1600, 1067)
        img = ImageOps.fit(img, target, Image.Resampling.LANCZOS)
        return img
    except Exception as exc:  # noqa: BLE001
        print(f"  fetch failed: {exc}")
        return None


def main() -> None:
    for folder, items in REMOTE.items():
        out_dir = ROOT / folder
        out_dir.mkdir(parents=True, exist_ok=True)
        for i, (url, portrait) in enumerate(items, start=1):
            path = out_dir / f"{i:02d}.jpg"
            print(f"{folder}/{path.name}")
            img = fetch(url, portrait)
            if img is None:
                img = paint_scene(folder, i - 1, portrait)
                img = vintage(img, i * 17)
            else:
                img = vintage_photo(img, i * 17)
            img.save(path, "JPEG", quality=84, optimize=True)
            print(f"  wrote {path} {img.size}")


if __name__ == "__main__":
    main()
