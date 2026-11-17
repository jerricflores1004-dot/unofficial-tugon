#!/usr/bin/env python3
"""Generate every TUGON launcher icon from the single master artwork.

The master file is `mobile/assets/icon/tugon_icon_1024.png`: the supplied
TUGON logo, squared off so the artwork fills the whole canvas (the original
rounded-square corners were reconstructed so the mark can bleed off any edge).

Everything else is derived from that one file, so the app always ships a
single look:

  * Android legacy mipmaps (`ic_launcher.png`, `ic_launcher_round.png`)
  * Android adaptive foreground layers (`ic_launcher_foreground.png`)
  * Android 12+ splash icon (`splash_icon.png`)
  * Web PWA icons, maskable icons and favicon
  * Windows `app_icon.ico`

Usage (from the `mobile/` directory):

    python3 tool/generate_app_icons.py

Requires Pillow:  pip install pillow
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw

MOBILE = Path(__file__).resolve().parent.parent
MASTER = MOBILE / "assets" / "icon" / "tugon_icon_1024.png"

# Deep navy sampled from the artwork's own background, used behind the art
# wherever a platform needs an opaque square or safe-zone padding.
NAVY = (2, 44, 147, 255)

# Android 12+ splash: the launcher-masked icon layer is 240dp, and 160dp of it
# is visible before the circular mask, so the mark is drawn inside 160dp.
SPLASH_ICON_DP = 160
# Android legacy launcher icon sizes (48dp * density).
LEGACY = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}
# Adaptive-icon foreground layer and Android 12 splash icon are both 108dp.
ADAPTIVE = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}
SPLASH = {
    "drawable-mdpi": 108,
    "drawable-hdpi": 162,
    "drawable-xhdpi": 216,
    "drawable-xxhdpi": 324,
    "drawable-xxxhdpi": 432,
}


def square(art: Image.Image, size: int) -> Image.Image:
    """Full-bleed square icon."""
    return art.resize((size, size), Image.LANCZOS)


def circular(art: Image.Image, size: int) -> Image.Image:
    """Round legacy icon for launchers that request `roundIcon`."""
    canvas = square(art, size)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    canvas.putalpha(mask)
    return canvas


def bleed(canvas: Image.Image) -> Image.Image:
    """Stretch the art's border pixels outward so padded icons have no rim."""
    w, h = canvas.size
    edge = max(2, w // 40)

    top = canvas.crop((0, 0, w, edge)).resize((w, 1), Image.BILINEAR)
    canvas.paste(top.resize((w, edge), Image.BILINEAR), (0, 0))
    bottom = canvas.crop((0, h - edge, w, h)).resize((w, 1), Image.BILINEAR)
    canvas.paste(bottom.resize((w, edge), Image.BILINEAR), (0, h - edge))
    left = canvas.crop((0, 0, edge, h)).resize((1, h), Image.BILINEAR)
    canvas.paste(left.resize((edge, h), Image.BILINEAR), (0, 0))
    right = canvas.crop((w - edge, 0, w, h)).resize((1, h), Image.BILINEAR)
    canvas.paste(right.resize((edge, h), Image.BILINEAR), (w - edge, 0))
    return canvas


def into_canvas(art: Image.Image, size: int, scale: float) -> Image.Image:
    """Artwork centred on the brand navy, then bled out to the canvas edge."""
    canvas = Image.new("RGBA", (size, size), NAVY)
    inner = round(size * scale)
    canvas.paste(square(art, inner), ((size - inner) // 2, (size - inner) // 2))
    return bleed(canvas)


def safe_zone(art: Image.Image, size: int, scale: float = 0.72) -> Image.Image:
    """Artwork inside Android's guaranteed-visible 72dp safe zone.

    Adaptive icons and the Android 12 splash draw into a 108dp canvas of which
    only the middle ~72dp is guaranteed visible once the launcher mask is
    applied, so the art is scaled into that zone instead of bleeding off.
    """
    return into_canvas(art, size, scale)


def splash_icon(art: Image.Image, size: int) -> Image.Image:
    """Android 12+ splash layer: transparent 108dp canvas, mark in 160/240."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = max(1, round(size * SPLASH_ICON_DP / 240))
    offset = (size - inner) // 2
    canvas.paste(square(art, inner).convert("RGBA"), (offset, offset))
    return canvas


def maskable(art: Image.Image, size: int, scale: float = 0.8) -> Image.Image:
    """Maskable PWA icon: the logo mark kept inside the maskable safe circle."""
    return into_canvas(art, size, scale)


def main() -> None:
    art = Image.open(MASTER).convert("RGBA")
    res = MOBILE / "android" / "app" / "src" / "main" / "res"
    web = MOBILE / "web"

    def write(out: Path, image: Image.Image, note: str) -> None:
        out.parent.mkdir(parents=True, exist_ok=True)
        image.save(out, optimize=True)
        print("wrote", out.relative_to(MOBILE), note)

    for folder, px in LEGACY.items():
        write(res / folder / "ic_launcher.png", square(art, px), f"({px}px)")
    for folder, px in LEGACY.items():
        write(res / folder / "ic_launcher_round.png", circular(art, px), f"({px}px, round)")
    for folder, px in ADAPTIVE.items():
        write(res / folder / "ic_launcher_foreground.png", safe_zone(art, px), f"({px}px)")
    for folder, px in SPLASH.items():
        write(res / folder / "splash_icon.png", splash_icon(art, px), f"({px}px)")

    write(web / "icons" / "Icon-192.png", square(art, 192), "(192px)")
    write(web / "icons" / "Icon-512.png", square(art, 512), "(512px)")
    write(web / "icons" / "Icon-maskable-192.png", maskable(art, 192), "(192px, maskable)")
    write(web / "icons" / "Icon-maskable-512.png", maskable(art, 512), "(512px, maskable)")
    write(web / "favicon.png", square(art, 32), "(32px)")

    ico_sizes = [16, 24, 32, 48, 64, 128, 256]
    ico = MOBILE / "windows" / "runner" / "resources" / "app_icon.ico"
    square(art, 256).save(ico, sizes=[(s, s) for s in ico_sizes])
    print("wrote", ico.relative_to(MOBILE), str(ico_sizes))


if __name__ == "__main__":
    try:
        main()
    except FileNotFoundError:
        sys.exit(
            f"Master artwork not found: {MASTER}\n"
            "Save the TUGON logo as a square PNG at that path first."
        )
