from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]

INK = "#03080B"
PANEL = "#061017"
PANEL_2 = "#081820"
LINE = "#18333A"
ACCENT = "#1DE2CC"
ACCENT_2 = "#0DBBBB"
DEEP = "#0A2D36"
WHITE = "#FFFFFF"
MIST = "#F2F2F2"
MUTED = "#A7BDC3"


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    value = value.strip("#")
    return tuple(int(value[i : i + 2], 16) for i in (0, 2, 4))


def mix(a: str, b: str, t: float) -> tuple[int, int, int]:
    ar, ag, ab = hex_to_rgb(a)
    br, bg, bb = hex_to_rgb(b)
    return (
        round(ar + (br - ar) * t),
        round(ag + (bg - ag) * t),
        round(ab + (bb - ab) * t),
    )


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


FONTS = {
    "hero": font(78, "black"),
    "h1": font(52, "black"),
    "h2": font(34, "bold"),
    "body": font(25, "regular"),
    "small": font(18, "regular"),
    "mono": font(18, "mono"),
    "button": font(20, "bold"),
}

LOGO_SOURCE = None
for logo_path in (ROOT / "assets/favicon-512x512.png", ROOT / "assets/apple-touch-icon.png"):
    if logo_path.exists():
        LOGO_SOURCE = Image.open(logo_path).convert("RGBA")
        break


def gradient_bg(width: int, height: int) -> Image.Image:
    img = Image.new("RGB", (width, height), INK)
    px = img.load()
    for y in range(height):
        vertical = y / max(height - 1, 1)
        for x in range(width):
            horizontal = x / max(width - 1, 1)
            base = mix(INK, PANEL, vertical * 0.7)
            teal = mix(DEEP, ACCENT_2, max(0, horizontal - 0.54) * 0.42)
            amount = max(0, horizontal - 0.62) * 0.3 + max(0, 0.18 - vertical) * 0.09
            px[x, y] = tuple(round(base[i] * (1 - amount) + teal[i] * amount) for i in range(3))
    return img


def add_grid(draw: ImageDraw.ImageDraw, width: int, height: int, step: int = 56) -> None:
    grid = (*hex_to_rgb(WHITE), 20)
    for x in range(0, width, step):
        draw.line((x, 0, x, height), fill=grid, width=1)
    for y in range(0, height, step):
        draw.line((0, y, width, y), fill=grid, width=1)


def add_diagonal(draw: ImageDraw.ImageDraw, width: int, height: int) -> None:
    draw.polygon(
        [(int(width * 0.71), -120), (int(width * 0.75), -120), (int(width * 0.58), height + 120), (int(width * 0.55), height + 120)],
        fill=(*hex_to_rgb(ACCENT), 92),
    )
    draw.line(
        (int(width * 0.71), -120, int(width * 0.55), height + 120),
        fill=(*hex_to_rgb(ACCENT), 180),
        width=3,
    )


def glow_layer(width: int, height: int, boxes: list[tuple[int, int, int, int]]) -> Image.Image:
    layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for box in boxes:
        d.rounded_rectangle(box, radius=18, fill=(*hex_to_rgb(ACCENT), 42))
    return layer.filter(ImageFilter.GaussianBlur(28))


def logo_mark(canvas: Image.Image, draw: ImageDraw.ImageDraw, x: int, y: int, size: int) -> None:
    if LOGO_SOURCE is None:
        draw.rounded_rectangle((x, y, x + size, y + size), radius=max(10, size // 5), fill=hex_to_rgb(DEEP))
        draw.rounded_rectangle((x, y, x + size, y + size), radius=max(10, size // 5), outline=hex_to_rgb(ACCENT), width=max(2, size // 26))
        return

    mark = LOGO_SOURCE.resize((size, size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size, size), radius=max(10, size // 5), fill=255)
    alpha = mark.getchannel("A")
    alpha = Image.composite(alpha, Image.new("L", (size, size), 0), mask)
    mark.putalpha(alpha)
    canvas.alpha_composite(mark, (x, y))


def text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], value: str, fnt: ImageFont.ImageFont, fill: str = WHITE) -> None:
    draw.text(xy, value, font=fnt, fill=hex_to_rgb(fill))


def wrap_text(draw: ImageDraw.ImageDraw, value: str, fnt: ImageFont.ImageFont, max_width: int) -> list[str]:
    lines: list[str] = []
    for raw_line in value.split("\n"):
        words = raw_line.split()
        current = ""
        for word in words:
            trial = f"{current} {word}".strip()
            if draw.textbbox((0, 0), trial, font=fnt)[2] <= max_width or not current:
                current = trial
            else:
                lines.append(current)
                current = word
        if current:
            lines.append(current)
    return lines


def draw_wrapped(draw: ImageDraw.ImageDraw, xy: tuple[int, int], value: str, fnt: ImageFont.ImageFont, width: int, fill: str, line_gap: int) -> int:
    y = xy[1]
    for line in wrap_text(draw, value, fnt, width):
        text(draw, (xy[0], y), line, fnt, fill)
        y += line_gap
    return y


def panel(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], radius: int = 18, fill: str = PANEL, outline: str = LINE) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=hex_to_rgb(fill), outline=hex_to_rgb(outline), width=2)


def chip(draw: ImageDraw.ImageDraw, x: int, y: int, label: str) -> None:
    pad_x = 18
    bbox = draw.textbbox((0, 0), label, font=FONTS["mono"])
    w = bbox[2] - bbox[0] + pad_x * 2
    draw.rounded_rectangle((x, y, x + w, y + 38), radius=8, fill=hex_to_rgb(PANEL_2), outline=hex_to_rgb(LINE), width=1)
    text(draw, (x + pad_x, y + 9), label, FONTS["mono"], ACCENT)


def dashboard(canvas: Image.Image, draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, title: str, seed: int) -> None:
    random.seed(seed)
    panel(draw, (x, y, x + w, y + h), 22, PANEL)
    text(draw, (x + 28, y + 24), title.upper(), FONTS["mono"], ACCENT)
    logo_mark(canvas, draw, x + w - 86, y + 20, 54)
    for i in range(4):
        yy = y + 92 + i * 88
        panel(draw, (x + 28, yy, x + w - 28, yy + 58), 10, PANEL_2)
        draw.ellipse((x + 48, yy + 21, x + 62, yy + 35), fill=hex_to_rgb(ACCENT if i % 2 == 0 else ACCENT_2))
        bar_w = random.randint(int(w * 0.34), int(w * 0.62))
        draw.rounded_rectangle((x + 86, yy + 18, x + 86 + bar_w, yy + 29), radius=5, fill=(*hex_to_rgb(MIST), 200))
        draw.rounded_rectangle((x + 86, yy + 36, x + 86 + int(bar_w * 0.66), yy + 44), radius=4, fill=(*hex_to_rgb(MUTED), 180))
    chart_y = y + h - 170
    for i in range(9):
        bx = x + 38 + i * 52
        bh = random.randint(34, 118)
        draw.rounded_rectangle((bx, chart_y + 124 - bh, bx + 25, chart_y + 124), radius=5, fill=hex_to_rgb(ACCENT if i in (2, 7) else DEEP))


def save_jpg(img: Image.Image, path: str) -> None:
    output = ROOT / path
    output.parent.mkdir(parents=True, exist_ok=True)
    img.convert("RGB").save(output, "JPEG", quality=88, optimize=True, progressive=True)


def save_png(img: Image.Image, path: str) -> None:
    output = ROOT / path
    output.parent.mkdir(parents=True, exist_ok=True)
    img.save(output, "PNG", optimize=True)


def make_hero(path: str, title: str, subtitle: str, label: str, seed: int) -> None:
    width, height = 1600, 1040
    img = gradient_bg(width, height).convert("RGBA")
    draw = ImageDraw.Draw(img, "RGBA")
    add_grid(draw, width, height, 64)
    add_diagonal(draw, width, height)
    img.alpha_composite(glow_layer(width, height, [(870, 140, 1460, 820), (1070, 450, 1530, 940)]))
    logo_mark(img, draw, 86, 84, 74)
    text(draw, (180, 92), "JC IT", FONTS["h2"], WHITE)
    text(draw, (180, 132), "SERVICES", FONTS["mono"], MIST)
    chip(draw, 88, 212, label.upper())
    y = draw_wrapped(draw, (88, 280), title, FONTS["hero"], 700, WHITE, 84)
    draw_wrapped(draw, (92, y + 24), subtitle, FONTS["body"], 650, MIST, 36)
    dashboard(img, draw, 910, 166, 540, 640, label, seed)
    panel(draw, (760, 680, 1150, 884), 18, PANEL_2)
    for i, metric in enumerate(["LIVE", "AI", "WEB"]):
        text(draw, (800 + i * 118, 728), metric, FONTS["mono"], ACCENT)
        text(draw, (800 + i * 118, 768), str([99, 24, 8][i]), FONTS["h2"], WHITE)
    save_jpg(img, path)


def make_service(path: str, title: str, label: str, icon: str, seed: int) -> None:
    width, height = 1200, 800
    img = gradient_bg(width, height).convert("RGBA")
    draw = ImageDraw.Draw(img, "RGBA")
    add_grid(draw, width, height, 54)
    add_diagonal(draw, width, height)
    img.alpha_composite(glow_layer(width, height, [(520, 130, 1060, 670)]))
    logo_mark(img, draw, 72, 64, 64)
    chip(draw, 72, 176, label.upper())
    draw_wrapped(draw, (72, 245), title, FONTS["h1"], 540, WHITE, 58)
    panel(draw, (640, 124, 1086, 646), 24, PANEL)
    text(draw, (698, 178), icon, font(104, "black"), ACCENT)
    for i in range(5):
        yy = 334 + i * 48
        draw.rounded_rectangle((704, yy, 1000 - i * 24, yy + 17), radius=8, fill=hex_to_rgb(ACCENT if i == 0 else MUTED))
    random.seed(seed)
    points = []
    for i in range(7):
        points.append((704 + i * 50, 558 - random.randint(18, 118)))
    draw.line(points, fill=hex_to_rgb(ACCENT), width=5)
    for point in points:
        draw.ellipse((point[0] - 6, point[1] - 6, point[0] + 6, point[1] + 6), fill=hex_to_rgb(WHITE))
    save_jpg(img, path)


def make_avatar(path: str, initials: str, name: str, seed: int) -> None:
    size = 256
    img = Image.new("RGBA", (size, size), INK)
    draw = ImageDraw.Draw(img, "RGBA")
    for y in range(size):
        color = mix(DEEP, ACCENT_2, y / size)
        draw.line((0, y, size, y), fill=color)
    draw.ellipse((24, 24, 232, 232), fill=(*hex_to_rgb(PANEL), 220), outline=hex_to_rgb(ACCENT), width=4)
    random.seed(seed)
    for _ in range(16):
        x = random.randint(28, 226)
        y = random.randint(28, 226)
        draw.ellipse((x, y, x + 3, y + 3), fill=(*hex_to_rgb(WHITE), 76))
    text(draw, (70, 73), initials, font(66, "black"), WHITE)
    text(draw, (53, 154), name.upper()[:14], font(16, "mono"), ACCENT)
    save_jpg(img, path)


def make_daddygrab() -> None:
    width, height = 1200, 1800
    img = gradient_bg(width, height).convert("RGBA")
    draw = ImageDraw.Draw(img, "RGBA")
    add_grid(draw, width, height, 68)
    add_diagonal(draw, width, height)
    img.alpha_composite(glow_layer(width, height, [(500, 150, 1050, 1500)]))
    logo_mark(img, draw, 90, 80, 84)
    text(draw, (198, 88), "DADDY GRAB", FONTS["h1"], WHITE)
    text(draw, (202, 150), "MOBILE STOREFRONT CONCEPT", FONTS["mono"], ACCENT)
    phone = (338, 254, 862, 1608)
    draw.rounded_rectangle(phone, radius=62, fill=hex_to_rgb("#050A0D"), outline=hex_to_rgb(LINE), width=4)
    screen = (382, 326, 818, 1530)
    draw.rounded_rectangle(screen, radius=34, fill=hex_to_rgb(PANEL), outline=hex_to_rgb(ACCENT), width=2)
    text(draw, (426, 378), "Daddy Grab", font(38, "black"), WHITE)
    text(draw, (430, 430), "AI-curated shop hub", font(18, "regular"), MIST)
    draw.rounded_rectangle((426, 494, 774, 650), radius=22, fill=hex_to_rgb(DEEP))
    text(draw, (458, 534), "Featured Drop", font(28, "bold"), WHITE)
    text(draw, (460, 578), "Ready for launch", font(18, "regular"), MIST)
    labels = ["Poppers", "Kits", "Events", "Deals"]
    for index, label in enumerate(labels):
        col = index % 2
        row = index // 2
        x = 426 + col * 178
        y = 704 + row * 176
        draw.rounded_rectangle((x, y, x + 158, y + 136), radius=22, fill=hex_to_rgb(PANEL_2), outline=hex_to_rgb(LINE), width=2)
        draw.ellipse((x + 30, y + 24, x + 74, y + 68), fill=hex_to_rgb(ACCENT))
        text(draw, (x + 28, y + 90), label, font(21, "bold"), WHITE)
    for i in range(4):
        y = 1092 + i * 88
        draw.rounded_rectangle((426, y, 774, y + 62), radius=16, fill=hex_to_rgb("#07151B"), outline=hex_to_rgb(LINE), width=1)
        draw.rounded_rectangle((446, y + 21, 618 + i * 30, y + 34), radius=6, fill=hex_to_rgb(ACCENT if i == 0 else MUTED))
    draw.rounded_rectangle((456, 1434, 744, 1492), radius=16, fill=hex_to_rgb(ACCENT))
    text(draw, (512, 1450), "LAUNCH STORE", FONTS["button"], INK)
    save_jpg(img, "daddygrab/assets/imagedaddy-grab.jpg")

    preview = img.crop((338, 254, 862, 1608)).resize((177, 300), Image.Resampling.LANCZOS)
    save_png(preview, "daddygrab/assets/daddygrab-app-preview.png")


def main() -> None:
    make_hero(
        "assets/images/hero-home.jpg",
        "Modern IT and AI systems for teams that need momentum.",
        "A branded operations console for websites, support flows, storefronts, and automations.",
        "Operations Console",
        1,
    )
    make_hero(
        "assets/images/hero-services.jpg",
        "Services built as connected systems, not one-off deliverables.",
        "Every offer gets a visual operating model, clear routing, and handoff-ready documentation.",
        "Service Matrix",
        2,
    )
    make_hero(
        "assets/images/hero-contact.jpg",
        "A cleaner communication hub for fast project intake.",
        "Contact paths, routing, and response expectations are designed to feel immediate.",
        "Contact Hub",
        3,
    )
    make_hero(
        "assets/images/hero-join.jpg",
        "A high-energy recruiting surface for growth roles.",
        "Sales, support, and operations workflows presented with crisp action states.",
        "Hiring Console",
        4,
    )
    make_hero(
        "assets/images/hero-thankyou.jpg",
        "Request received. The system is already moving.",
        "Confirmation pages now feel like part of the same operational experience.",
        "Success State",
        5,
    )
    make_hero(
        "assets/images/team-generic.jpg",
        "Team access with a sharper internal systems feel.",
        "A secure, branded view for dashboards, manuals, and internal workflows.",
        "Team Portal",
        6,
    )

    services = [
        ("assets/images/service-website.jpg", "Websites and funnels with a stronger first impression.", "Web Systems", "WEB", 11),
        ("assets/images/service-pbx.jpg", "PBX routing and voice workflows made visible.", "Voice Ops", "PBX", 12),
        ("assets/images/service-ai.jpg", "AI agents, intake, and follow-up logic.", "AI Enablement", "AI", 13),
        ("assets/images/service-ops.jpg", "Dashboards for daily operating rhythm.", "Ops Console", "OPS", 14),
        ("assets/images/service-helpdesk.jpg", "Support queues with cleaner triage signals.", "Helpdesk", "SOS", 15),
        ("assets/images/service-virtual.jpg", "Remote team systems and virtual support.", "Virtual Ops", "VRT", 16),
        ("assets/images/service-appdev.jpg", "Custom app screens and admin tooling.", "App Dev", "APP", 17),
        ("assets/images/service-bots.jpg", "Bots and automations with guardrails.", "Bots", "BOT", 18),
        ("assets/images/service-app.jpg", "Product UI concepts for launch-ready tools.", "App UI", "UI", 19),
        ("assets/images/service-telegram.jpg", "Messaging automation and community flows.", "Messaging", "MSG", 20),
        ("assets/images/service-mind-check.jpg", "Mind-check workflows for structured decisions.", "Mind Check", "CHK", 21),
    ]
    for item in services:
        make_service(*item)

    make_avatar("assets/images/testimonial-1.jpg", "RH", "Rhy", 31)
    make_avatar("assets/images/testimonial-2.jpg", "MP", "Montana", 32)
    make_avatar("assets/images/testimonial-3.jpg", "JG", "John", 33)
    make_daddygrab()


if __name__ == "__main__":
    main()
