from __future__ import annotations

import subprocess
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
SOURCE_COMMIT = "e72f78c"
REFERENCE_ASSET = "assets/images/jcit-brand-person-reference.png"

INK = "#03080B"
PANEL = "#061017"
LINE = "#18333A"
ACCENT = "#1DE2CC"
ACCENT_2 = "#0DBBBB"
WHITE = "#FFFFFF"
MIST = "#F2F2F2"


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.strip("#")
    return tuple(int(value[index : index + 2], 16) for index in (0, 2, 4))


def font(size: int, weight: str = "regular") -> ImageFont.FreeTypeFont:
    candidates = {
        "black": [
            "/System/Library/Fonts/Supplemental/Arial Black.ttf",
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        ],
        "bold": [
            "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
            "/System/Library/Fonts/Supplemental/Arial Black.ttf",
        ],
        "regular": [
            "/System/Library/Fonts/Supplemental/Arial.ttf",
            "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        ],
        "mono": [
            "/System/Library/Fonts/Supplemental/Courier New Bold.ttf",
            "/System/Library/Fonts/Supplemental/Courier New.ttf",
        ],
    }
    for path in candidates.get(weight, candidates["regular"]):
        if Path(path).exists():
            return ImageFont.truetype(path, size=size)
    return ImageFont.load_default(size=size)


FONT_BOLD = font(32, "bold")
FONT_SMALL = font(22, "regular")


def load_original(path: str) -> Image.Image:
    local_path = ROOT / path
    if local_path.exists():
        return Image.open(local_path).convert("RGB")
    data = subprocess.check_output(["git", "show", f"{SOURCE_COMMIT}:{path}"])
    return Image.open(BytesIO(data)).convert("RGB")


def cover(image: Image.Image, size: tuple[int, int], anchor: tuple[float, float] = (0.5, 0.5)) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / image.width, target_h / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    max_x = max(0, resized.width - target_w)
    max_y = max(0, resized.height - target_h)
    left = round(max_x * anchor[0])
    top = round(max_y * anchor[1])
    return resized.crop((left, top, left + target_w, top + target_h))


def paste_logo(canvas: Image.Image, x: int, y: int, size: int) -> None:
    logo_path = ROOT / "assets/favicon-512x512.png"
    logo = Image.open(logo_path).convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size, size), radius=max(12, size // 5), fill=255)
    logo.putalpha(Image.composite(logo.getchannel("A"), Image.new("L", (size, size), 0), mask))
    canvas.alpha_composite(logo, (x, y))


def gradient_overlay(size: tuple[int, int], left_alpha: int = 146, bottom_alpha: int = 116) -> Image.Image:
    width, height = size
    overlay = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")

    for x in range(width):
        amount = max(0, 1 - x / max(1, width * 0.7))
        alpha = round(left_alpha * amount)
        if alpha:
            draw.line((x, 0, x, height), fill=(*hex_to_rgb(INK), alpha))

    for y in range(height):
        amount = max(0, (y - height * 0.45) / max(1, height * 0.55))
        alpha = round(bottom_alpha * amount)
        if alpha:
            draw.line((0, y, width, y), fill=(*hex_to_rgb(INK), alpha))

    return overlay


def draw_brand_chrome(canvas: Image.Image, label: str, diagonal: float = 0.66) -> None:
    width, height = canvas.size
    draw = ImageDraw.Draw(canvas, "RGBA")

    band_x = int(width * diagonal)
    draw.polygon(
        [
            (band_x, -120),
            (band_x + max(38, width // 32), -120),
            (band_x - max(190, width // 8), height + 120),
            (band_x - max(228, width // 7), height + 120),
        ],
        fill=(*hex_to_rgb(ACCENT), 132),
    )
    draw.line((band_x, -120, band_x - max(190, width // 8), height + 120), fill=(*hex_to_rgb(ACCENT), 230), width=max(3, width // 360))

    ribbon_w = min(320, int(width * 0.3))
    ribbon_h = max(56, int(height * 0.072))
    ribbon_x = width - ribbon_w - max(24, int(width * 0.028))
    ribbon_y = max(22, int(height * 0.035))
    draw.rounded_rectangle(
        (ribbon_x, ribbon_y, ribbon_x + ribbon_w, ribbon_y + ribbon_h),
        radius=18,
        fill=(*hex_to_rgb(ACCENT_2), 218),
    )
    globe_x = ribbon_x + 26
    globe_y = ribbon_y + ribbon_h // 2
    radius = ribbon_h // 5
    draw.ellipse((globe_x - radius, globe_y - radius, globe_x + radius, globe_y + radius), outline=hex_to_rgb(WHITE), width=2)
    draw.line((globe_x - radius, globe_y, globe_x + radius, globe_y), fill=hex_to_rgb(WHITE), width=1)
    draw.line((globe_x, globe_y - radius, globe_x, globe_y + radius), fill=hex_to_rgb(WHITE), width=1)
    draw.text((globe_x + 28, ribbon_y + ribbon_h // 2 - 15), "jcit.digital", font=FONT_BOLD, fill=hex_to_rgb(WHITE))

    logo_size = max(56, int(min(width, height) * 0.078))
    paste_logo(canvas, max(24, int(width * 0.036)), max(22, int(height * 0.04)), logo_size)
    draw.text(
        (max(24, int(width * 0.036)) + logo_size + 18, max(22, int(height * 0.04)) + 9),
        label.upper(),
        font=FONT_SMALL,
        fill=hex_to_rgb(MIST),
    )


def brand_photo(
    source_path: str,
    output_path: str,
    size: tuple[int, int],
    label: str,
    anchor: tuple[float, float] = (0.5, 0.5),
    diagonal: float = 0.66,
    chrome: bool = True,
) -> Image.Image:
    base = cover(load_original(source_path), size, anchor)
    base = ImageEnhance.Color(base).enhance(0.82)
    base = ImageEnhance.Contrast(base).enhance(1.08)
    base = ImageEnhance.Brightness(base).enhance(0.86)

    image = base.convert("RGBA")
    image.alpha_composite(gradient_overlay(size, left_alpha=96 if chrome else 54, bottom_alpha=82 if chrome else 42))

    wash = Image.new("RGBA", size, (*hex_to_rgb(ACCENT), 20))
    image.alpha_composite(wash)
    if chrome:
        draw_brand_chrome(image, label, diagonal)

    save_jpg(image, output_path)
    return image


def save_jpg(image: Image.Image, path: str) -> None:
    output = ROOT / path
    output.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(output, "JPEG", quality=88, optimize=True, progressive=True)


def save_png(image: Image.Image, path: str) -> None:
    output = ROOT / path
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, "PNG", optimize=True)


def branded_avatar(source_path: str, output_path: str, anchor: tuple[float, float]) -> None:
    size = 256
    photo = cover(load_original(source_path), (size, size), anchor)
    photo = ImageEnhance.Color(photo).enhance(0.82)
    photo = ImageEnhance.Contrast(photo).enhance(1.1)
    image = photo.convert("RGBA")

    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((12, 12, size - 12, size - 12), fill=255)
    alpha = Image.composite(Image.new("L", (size, size), 255), Image.new("L", (size, size), 0), mask)
    image.putalpha(alpha)

    frame = Image.new("RGBA", (size, size), (*hex_to_rgb(INK), 0))
    frame.alpha_composite(image)
    draw = ImageDraw.Draw(frame, "RGBA")
    draw.ellipse((10, 10, size - 10, size - 10), outline=hex_to_rgb(ACCENT), width=5)
    draw.line((size * 0.73, -18, size * 0.49, size + 26), fill=(*hex_to_rgb(ACCENT), 180), width=5)
    save_jpg(frame, output_path)


def daddygrab_visual() -> None:
    canvas = brand_photo(
        REFERENCE_ASSET,
        "daddygrab/assets/imagedaddy-grab.jpg",
        (1200, 1800),
        "Daddy Grab",
        anchor=(0.58, 0.5),
        diagonal=0.72,
        chrome=False,
    )
    draw = ImageDraw.Draw(canvas, "RGBA")
    phone = (620, 470, 1060, 1510)
    draw.rounded_rectangle(phone, radius=54, fill=(*hex_to_rgb(INK), 238), outline=hex_to_rgb(LINE), width=4)
    screen = (660, 548, 1020, 1428)
    draw.rounded_rectangle(screen, radius=32, fill=(*hex_to_rgb(PANEL), 246), outline=hex_to_rgb(ACCENT), width=2)
    draw.text((704, 620), "Daddy Grab", font=font(42, "black"), fill=hex_to_rgb(WHITE))
    draw.text((708, 676), "AI-curated shop hub", font=FONT_SMALL, fill=hex_to_rgb(MIST))
    for index, label in enumerate(["Drops", "Deals", "Events", "Kits"]):
        col = index % 2
        row = index // 2
        x = 704 + col * 154
        y = 780 + row * 154
        draw.rounded_rectangle((x, y, x + 126, y + 112), radius=18, fill=(*hex_to_rgb("#0A2D36"), 220), outline=hex_to_rgb(LINE), width=2)
        draw.ellipse((x + 22, y + 18, x + 58, y + 54), fill=hex_to_rgb(ACCENT))
        draw.text((x + 22, y + 70), label, font=font(20, "bold"), fill=hex_to_rgb(WHITE))
    draw.rounded_rectangle((704, 1258, 974, 1320), radius=18, fill=hex_to_rgb(ACCENT))
    draw.text((755, 1274), "LAUNCH STORE", font=font(19, "bold"), fill=hex_to_rgb(INK))
    save_jpg(canvas, "daddygrab/assets/imagedaddy-grab.jpg")
    save_png(canvas.crop((620, 470, 1060, 1510)).resize((177, 300), Image.Resampling.LANCZOS), "daddygrab/assets/daddygrab-app-preview.png")


def main() -> None:
    hero_size = (1600, 1040)
    service_size = (1200, 800)

    hero_jobs = [
        ("assets/images/hero-home.jpg", (0.48, 0.42)),
        ("assets/images/hero-services.jpg", (0.54, 0.44)),
        ("assets/images/hero-contact.jpg", (0.6, 0.45)),
        ("assets/images/hero-join.jpg", (0.5, 0.48)),
        ("assets/images/hero-thankyou.jpg", (0.58, 0.48)),
        ("assets/images/team-generic.jpg", (0.63, 0.43)),
    ]
    for output, anchor in hero_jobs:
        brand_photo(REFERENCE_ASSET, output, hero_size, "JC IT Services", anchor, 0.66, chrome=False)

    service_jobs = [
        ("assets/images/service-website.jpg", (0.48, 0.42)),
        ("assets/images/service-pbx.jpg", (0.56, 0.43)),
        ("assets/images/service-ai.jpg", (0.62, 0.46)),
        ("assets/images/service-ops.jpg", (0.5, 0.47)),
        ("assets/images/service-helpdesk.jpg", (0.58, 0.48)),
        ("assets/images/service-virtual.jpg", (0.64, 0.45)),
        ("assets/images/service-appdev.jpg", (0.52, 0.44)),
        ("assets/images/service-bots.jpg", (0.58, 0.44)),
        ("assets/images/service-app.jpg", (0.46, 0.5)),
        ("assets/images/service-telegram.jpg", (0.52, 0.5)),
        ("assets/images/service-mind-check.jpg", (0.6, 0.5)),
    ]
    for output, anchor in service_jobs:
        brand_photo(REFERENCE_ASSET, output, service_size, "JC IT Services", anchor, 0.67, chrome=False)

    branded_avatar(REFERENCE_ASSET, "assets/images/testimonial-1.jpg", (0.55, 0.5))
    branded_avatar(REFERENCE_ASSET, "assets/images/testimonial-2.jpg", (0.58, 0.52))
    branded_avatar(REFERENCE_ASSET, "assets/images/testimonial-3.jpg", (0.52, 0.48))
    daddygrab_visual()


if __name__ == "__main__":
    main()
