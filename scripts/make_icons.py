"""Draw the app icon (a pastel piggy-bank coin) at every size the web app and Android need."""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def draw_icon(size: int, maskable: bool = False, transparent: bool = False) -> Image.Image:
    s = size * 4  # draw large, then shrink for smooth edges
    img = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # background: soft pink → lavender
    if not transparent:
        bg = Image.new('RGBA', (s, s))
        top, bottom = (255, 200, 221), (224, 212, 255)
        for y in range(s):
            t = y / s
            c = tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3)) + (255,)
            ImageDraw.Draw(bg).line([(0, y), (s, y)], fill=c)
        if maskable:
            img = bg
        else:
            mask = Image.new('L', (s, s), 0)
            ImageDraw.Draw(mask).rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * 0.23), fill=255)
            img.paste(bg, (0, 0), mask)
        d = ImageDraw.Draw(img)
    scale = 0.62 if maskable or transparent else 0.74
    cx, cy = s / 2, s / 2 + s * 0.02
    r = s * scale / 2
    # soft shadow
    sh = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([cx - r, cy - r + s * 0.03, cx + r, cy + r + s * 0.03], fill=(193, 69, 123, 70))
    sh = sh.filter(ImageFilter.GaussianBlur(s * 0.02))
    img.alpha_composite(sh)
    d = ImageDraw.Draw(img)
    # piggy body
    d.ellipse([cx - r, cy - r * 0.86, cx + r, cy + r * 0.86], fill=(255, 143, 184))
    # ears
    d.polygon([(cx - r * 0.55, cy - r * 0.62), (cx - r * 0.25, cy - r * 0.78), (cx - r * 0.5, cy - r * 1.08)], fill=(255, 120, 168))
    d.polygon([(cx + r * 0.55, cy - r * 0.62), (cx + r * 0.25, cy - r * 0.78), (cx + r * 0.5, cy - r * 1.08)], fill=(255, 120, 168))
    # coin
    cr = r * 0.24
    ccx, ccy = cx, cy - r * 0.9
    d.ellipse([ccx - cr, ccy - cr, ccx + cr, ccy + cr], fill=(255, 226, 120), outline=(214, 170, 40), width=int(cr * 0.16))
    # coin slot
    d.rounded_rectangle([cx - r * 0.28, cy - r * 0.66, cx + r * 0.28, cy - r * 0.56], radius=int(r * 0.05), fill=(193, 69, 123))
    # snout
    d.ellipse([cx - r * 0.34, cy - r * 0.02, cx + r * 0.34, cy + r * 0.4], fill=(255, 190, 214))
    d.ellipse([cx - r * 0.17, cy + r * 0.1, cx - r * 0.06, cy + r * 0.27], fill=(193, 69, 123))
    d.ellipse([cx + r * 0.06, cy + r * 0.1, cx + r * 0.17, cy + r * 0.27], fill=(193, 69, 123))
    # eyes
    d.ellipse([cx - r * 0.5, cy - r * 0.3, cx - r * 0.36, cy - r * 0.14], fill=(63, 52, 72))
    d.ellipse([cx + r * 0.36, cy - r * 0.3, cx + r * 0.5, cy - r * 0.14], fill=(63, 52, 72))
    # cheeks
    d.ellipse([cx - r * 0.78, cy - r * 0.05, cx - r * 0.5, cy + r * 0.15], fill=(255, 179, 193))
    d.ellipse([cx + r * 0.5, cy - r * 0.05, cx + r * 0.78, cy + r * 0.15], fill=(255, 179, 193))
    return img.resize((size, size), Image.LANCZOS)


def save(img: Image.Image, path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.save(path)


def main() -> None:
    pub = os.path.join(ROOT, 'public', 'icons')
    save(draw_icon(192), os.path.join(pub, 'icon-192.png'))
    save(draw_icon(512), os.path.join(pub, 'icon-512.png'))
    save(draw_icon(512, maskable=True), os.path.join(pub, 'maskable-512.png'))
    save(draw_icon(180, maskable=True).convert('RGB'), os.path.join(pub, 'apple-touch-icon.png'))
    res = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')
    if '--android' in sys.argv and os.path.isdir(res):
        for name, px in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
            folder = os.path.join(res, f'mipmap-{name}')
            save(draw_icon(px), os.path.join(folder, 'ic_launcher.png'))
            save(draw_icon(px), os.path.join(folder, 'ic_launcher_round.png'))
            fg = int(px * 108 / 48)
            save(draw_icon(fg, transparent=True), os.path.join(folder, 'ic_launcher_foreground.png'))
        import glob
        for sp in glob.glob(os.path.join(res, 'drawable*', 'splash.png')):
            w, h = Image.open(sp).size
            bg = Image.new('RGBA', (w, h))
            top, bottom = (255, 246, 250), (253, 238, 246)
            dr = ImageDraw.Draw(bg)
            for y in range(h):
                t = y / h
                dr.line([(0, y), (w, y)], fill=tuple(int(top[i] * (1 - t) + bottom[i] * t) for i in range(3)) + (255,))
            icon = draw_icon(int(min(w, h) * 0.42))
            bg.alpha_composite(icon, ((w - icon.width) // 2, (h - icon.height) // 2))
            bg.convert('RGB').save(sp)
        print('android icons written')
    print('icons written')


if __name__ == '__main__':
    main()
