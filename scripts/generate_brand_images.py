from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
UPLOAD_DIRS = (
    Path("/Users/mymacyou/Downloads/website_images"),
    Path("/Users/mymacyou/Downloads/website images brand"),
)
REPO_SOURCE = ROOT / "assets/images/source"

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
    return tuple(int(value[index : index + 2], 16) for index in (0, 2, 4))


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
    "hero": font(72, "black"),
    "h1": font(50, "black"),
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


def source_path(*names: str) -> Path:
    for directory in (*UPLOAD_DIRS, REPO_SOURCE):
        for name in names:
            path = directory / name
            if path.exists():
                return path
    raise FileNotFoundError(f"Missing source image. Tried: {', '.join(names)}")


SOURCE_MAP = {
    "team": source_path("team-work-collage.png", "19fe8384-ef0c-453c-b7f3-6da7eec71f81.png"),
    "jcit": source_path("jcit-team-collage.png", "5c1a39e5-cace-43ea-8e4a-6dc56e880a91.png"),
    "web": source_path("web-development.png", "webdev.png", "e51160c4-83e3-48ca-9fd2-a8e624a91114.png"),
    "pbx": source_path("pbx-support.png", "pbx.png"),
    "ai": source_path("ai-workflows.png", "ai.png"),
}


PANELS: dict[str, tuple[str, tuple[int, int, int, int]]] = {
    "hero-laptop": ("jcit", (8, 8, 758, 594)),
    "thinking": ("jcit", (774, 8, 1110, 354)),
    "code-side": ("jcit", (1124, 8, 1528, 354)),
    "team-laptop": ("jcit", (774, 368, 1528, 716)),
    "coffee": ("jcit", (8, 608, 426, 1016)),
    "hands": ("jcit", (440, 608, 758, 1016)),
    "office": ("jcit", (774, 730, 1528, 1016)),
    "portrait": ("team", (552, 8, 978, 402)),
    "dev-laptop": ("team", (8, 8, 540, 402)),
    "dev-monitors": ("team", (990, 8, 1528, 402)),
    "whiteboard": ("team", (8, 416, 484, 712)),
    "couch-laptop": ("team", (500, 416, 928, 712)),
    "workshop": ("team", (940, 416, 1528, 712)),
    "headset": ("team", (8, 728, 532, 1016)),
    "meeting-room": ("team", (548, 728, 990, 1016)),
    "smile": ("team", (1008, 728, 1528, 1016)),
}


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


def cover(image: Image.Image, size: tuple[int, int], anchor: tuple[float, float] = (0.5, 0.5)) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / image.width, target_h / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    max_x = max(0, resized.width - target_w)
    max_y = max(0, resized.height - target_h)
    left = round(max_x * anchor[0])
    top = round(max_y * anchor[1])
    return resized.crop((left, top, left + target_w, top + target_h))


def source_panel(name: str) -> Image.Image:
    key, box = PANELS[name]
    return Image.open(SOURCE_MAP[key]).convert("RGB").crop(box)


def source_full(name: str) -> Image.Image:
    return Image.open(SOURCE_MAP[name]).convert("RGB")


def add_grid(draw: ImageDraw.ImageDraw, width: int, height: int, step: int = 56, alpha: int = 20) -> None:
    grid = (*hex_to_rgb(WHITE), alpha)
    for x in range(0, width, step):
        draw.line((x, 0, x, height), fill=grid, width=1)
    for y in range(0, height, step):
        draw.line((0, y, width, y), fill=grid, width=1)


def add_diagonal(draw: ImageDraw.ImageDraw, width: int, height: int, alpha: int = 92) -> None:
    draw.polygon(
        [(int(width * 0.71), -120), (int(width * 0.75), -120), (int(width * 0.58), height + 120), (int(width * 0.55), height + 120)],
        fill=(*hex_to_rgb(ACCENT), alpha),
    )
    draw.line(
        (int(width * 0.71), -120, int(width * 0.55), height + 120),
        fill=(*hex_to_rgb(ACCENT), min(230, alpha + 88)),
        width=max(3, width // 460),
    )


def glow_layer(width: int, height: int, boxes: list[tuple[int, int, int, int]]) -> Image.Image:
    layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    for box in boxes:
        draw.rounded_rectangle(box, radius=18, fill=(*hex_to_rgb(ACCENT), 42))
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
    width = bbox[2] - bbox[0] + pad_x * 2
    draw.rounded_rectangle((x, y, x + width, y + 38), radius=8, fill=hex_to_rgb(PANEL_2), outline=hex_to_rgb(LINE), width=1)
    text(draw, (x + pad_x, y + 9), label, FONTS["mono"], ACCENT)


def overlay_photo(image: Image.Image, strength: int = 118) -> Image.Image:
    image = ImageEnhance.Color(image).enhance(0.9)
    image = ImageEnhance.Contrast(image).enhance(1.06)
    image = ImageEnhance.Brightness(image).enhance(0.78)
    rgba = image.convert("RGBA")
    width, height = rgba.size
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay, "RGBA")
    for x in range(width):
        alpha = round(strength * max(0, 1 - x / max(1, width * 0.75)))
        if alpha:
            draw.line((x, 0, x, height), fill=(*hex_to_rgb(INK), alpha))
    for y in range(height):
        alpha = round(88 * max(0, (y - height * 0.35) / max(1, height * 0.65)))
        if alpha:
            draw.line((0, y, width, y), fill=(*hex_to_rgb(INK), alpha))
    draw.rectangle((0, 0, width, height), fill=(*hex_to_rgb(ACCENT), 12))
    add_grid(draw, width, height, 58, 18)
    add_diagonal(draw, width, height, 66)
    rgba.alpha_composite(overlay)
    return rgba


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
    points = []
    for i in range(7):
        points.append((x + 70 + i * 56, chart_y + 104 - random.randint(18, 96)))
    draw.line(points, fill=hex_to_rgb(ACCENT), width=4)
    for point in points:
        draw.ellipse((point[0] - 6, point[1] - 6, point[0] + 6, point[1] + 6), fill=hex_to_rgb(WHITE))


def ui_mockup(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, label: str, seed: int) -> None:
    random.seed(seed)
    panel(draw, (x, y, x + w, y + h), 20, PANEL)
    text(draw, (x + 28, y + 24), label.upper(), FONTS["mono"], ACCENT)
    for i in range(3):
        draw.ellipse((x + w - 88 + i * 18, y + 34, x + w - 78 + i * 18, y + 44), fill=hex_to_rgb(ACCENT if i == 0 else MUTED))
    for i in range(5):
        yy = y + 88 + i * 52
        width = random.randint(round(w * 0.32), round(w * 0.76))
        draw.rounded_rectangle((x + 34, yy, x + 34 + width, yy + 14), radius=7, fill=hex_to_rgb(ACCENT if i == 0 else MUTED))
        draw.rounded_rectangle((x + 34, yy + 24, x + 34 + int(width * 0.58), yy + 34), radius=5, fill=(*hex_to_rgb(MIST), 150))
    for i in range(6):
        bx = x + 42 + i * 48
        bh = random.randint(28, 112)
        draw.rounded_rectangle((bx, y + h - 52 - bh, bx + 24, y + h - 52), radius=5, fill=hex_to_rgb(ACCENT if i in (1, 4) else DEEP))


def save_jpg(image: Image.Image, path: str) -> None:
    output = ROOT / path
    output.parent.mkdir(parents=True, exist_ok=True)
    if image.mode == "RGBA":
        base = Image.new("RGBA", image.size, (*hex_to_rgb(INK), 255))
        base.alpha_composite(image)
        image = base
    image.convert("RGB").save(output, "JPEG", quality=88, optimize=True, progressive=True)


def save_png(image: Image.Image, path: str) -> None:
    output = ROOT / path
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, "PNG", optimize=True)


def make_hero(path: str, title: str, subtitle: str, label: str, source: str, seed: int) -> None:
    width, height = 1600, 1040
    photo = cover(source_panel(source), (width, height), (0.5, 0.5))
    image = overlay_photo(photo, 152)
    draw = ImageDraw.Draw(image, "RGBA")
    image.alpha_composite(glow_layer(width, height, [(860, 126, 1490, 836), (1040, 470, 1540, 980)]))
    logo_mark(image, draw, 86, 84, 74)
    text(draw, (180, 92), "JC IT", FONTS["h2"], WHITE)
    text(draw, (180, 132), "SERVICES", FONTS["mono"], MIST)
    chip(draw, 88, 212, label.upper())
    y = draw_wrapped(draw, (88, 280), title, FONTS["hero"], 705, WHITE, 80)
    draw_wrapped(draw, (92, y + 22), subtitle, FONTS["body"], 660, MIST, 36)
    dashboard(image, draw, 910, 166, 540, 640, label, seed)
    panel(draw, (760, 680, 1150, 884), 18, PANEL_2)
    for i, metric in enumerate(["LIVE", "AI", "WEB"]):
        text(draw, (800 + i * 118, 728), metric, FONTS["mono"], ACCENT)
        text(draw, (800 + i * 118, 768), str([99, 24, 8][i]), FONTS["h2"], WHITE)
    save_jpg(image, path)


def make_home_media() -> None:
    width, height = 1200, 760
    image = overlay_photo(cover(source_panel("hero-laptop"), (width, height), (0.5, 0.5)), 86)
    draw = ImageDraw.Draw(image, "RGBA")
    image.alpha_composite(glow_layer(width, height, [(620, 100, 1120, 690)]))
    add_diagonal(draw, width, height, 96)
    logo_mark(image, draw, 58, 54, 66)
    text(draw, (142, 62), "JC IT", FONTS["h2"], WHITE)
    text(draw, (144, 104), "SERVICES", FONTS["mono"], MIST)
    panel(draw, (724, 92, 1080, 298), 20, PANEL)
    text(draw, (764, 132), "AI + IT OPS", font(34, "black"), ACCENT)
    for index, label in enumerate(["Web systems", "PBX support", "AI workflows"]):
        y = 192 + index * 42
        draw.ellipse((766, y + 5, 778, y + 17), fill=hex_to_rgb(ACCENT))
        text(draw, (794, y), label, FONTS["small"], MIST)
    save_jpg(image, "assets/images/hero-home-media.jpg")


def make_service(path: str, title: str, label: str, icon: str, source: str, seed: int, full_source: bool = False) -> None:
    width, height = 1200, 800
    base = source_full(source) if full_source else source_panel(source)
    photo = cover(base, (width, height), (0.5, 0.5))
    image = overlay_photo(photo, 112)
    draw = ImageDraw.Draw(image, "RGBA")
    image.alpha_composite(glow_layer(width, height, [(520, 130, 1060, 670)]))
    logo_mark(image, draw, 72, 64, 64)
    chip(draw, 72, 176, label.upper())
    draw_wrapped(draw, (72, 245), title, FONTS["h1"], 540, WHITE, 56)
    panel(draw, (640, 124, 1086, 646), 24, PANEL)
    text(draw, (698, 178), icon, font(96, "black"), ACCENT)
    ui_mockup(draw, 698, 330, 312, 224, label, seed)
    save_jpg(image, path)


def make_avatar(path: str, source: str, seed: int) -> None:
    size = 256
    random.seed(seed)
    photo = cover(source_panel(source), (size, size), (0.5, 0.38))
    photo = ImageEnhance.Color(photo).enhance(0.86)
    photo = ImageEnhance.Contrast(photo).enhance(1.12)
    image = photo.convert("RGBA")
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((12, 12, size - 12, size - 12), fill=255)
    image.putalpha(mask)

    frame = gradient_bg(size, size).convert("RGBA")
    frame.alpha_composite(image)
    draw = ImageDraw.Draw(frame, "RGBA")
    draw.ellipse((10, 10, size - 10, size - 10), outline=hex_to_rgb(ACCENT), width=5)
    draw.line((size * 0.73, -18, size * 0.49, size + 26), fill=(*hex_to_rgb(ACCENT), 180), width=5)
    logo_mark(frame, draw, 166, 166, 42)
    save_jpg(frame, path)


def make_daddygrab() -> None:
    width, height = 1200, 1800
    image = overlay_photo(cover(source_panel("hands"), (width, height), (0.5, 0.5)), 142)
    draw = ImageDraw.Draw(image, "RGBA")
    image.alpha_composite(glow_layer(width, height, [(470, 160, 1060, 1560)]))
    logo_mark(image, draw, 90, 80, 84)
    text(draw, (198, 88), "DADDY GRAB", FONTS["h1"], WHITE)
    text(draw, (202, 150), "MOBILE STOREFRONT CONCEPT", FONTS["mono"], ACCENT)
    phone = (338, 254, 862, 1608)
    draw.rounded_rectangle(phone, radius=62, fill=(*hex_to_rgb("#050A0D"), 242), outline=hex_to_rgb(LINE), width=4)
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
    save_jpg(image, "daddygrab/assets/imagedaddy-grab.jpg")

    preview = image.crop((338, 254, 862, 1608)).resize((177, 300), Image.Resampling.LANCZOS)
    save_png(preview, "daddygrab/assets/daddygrab-app-preview.png")


def main() -> None:
    make_hero(
        "assets/images/hero-home.jpg",
        "Modern IT and AI systems for teams that need momentum.",
        "A branded operations console for websites, support flows, storefronts, and automations.",
        "Operations Console",
        "hero-laptop",
        1,
    )
    make_home_media()
    make_hero(
        "assets/images/hero-services.jpg",
        "Services built as connected systems, not one-off deliverables.",
        "Every offer gets a visual operating model, clear routing, and handoff-ready documentation.",
        "Service Matrix",
        "workshop",
        2,
    )
    make_hero(
        "assets/images/hero-contact.jpg",
        "A cleaner communication hub for fast project intake.",
        "Contact paths, routing, and response expectations are designed to feel immediate.",
        "Contact Hub",
        "headset",
        3,
    )
    make_hero(
        "assets/images/hero-join.jpg",
        "A high-energy recruiting surface for growth roles.",
        "Sales, support, and operations workflows presented with crisp action states.",
        "Hiring Console",
        "team-laptop",
        4,
    )
    make_hero(
        "assets/images/hero-thankyou.jpg",
        "Request received. The system is already moving.",
        "Confirmation pages now feel like part of the same operational experience.",
        "Success State",
        "office",
        5,
    )
    make_hero(
        "assets/images/team-generic.jpg",
        "Team access with a sharper internal systems feel.",
        "A secure, branded view for dashboards, manuals, and internal workflows.",
        "Team Portal",
        "meeting-room",
        6,
    )

    services = [
        ("assets/images/service-website.jpg", "Websites and funnels with a stronger first impression.", "Web Systems", "WEB", "web", 11, True),
        ("assets/images/service-pbx.jpg", "PBX routing and voice workflows made visible.", "Voice Ops", "PBX", "pbx", 12, True),
        ("assets/images/service-ai.jpg", "AI agents, intake, and follow-up logic.", "AI Enablement", "AI", "ai", 13, True),
        ("assets/images/service-ops.jpg", "Dashboards for daily operating rhythm.", "Ops Console", "OPS", "office", 14, False),
        ("assets/images/service-helpdesk.jpg", "Support queues with cleaner triage signals.", "Helpdesk", "SOS", "headset", 15, False),
        ("assets/images/service-virtual.jpg", "Remote team systems and virtual support.", "Virtual Ops", "VRT", "couch-laptop", 16, False),
        ("assets/images/service-appdev.jpg", "Custom app screens and admin tooling.", "App Dev", "APP", "dev-monitors", 17, False),
        ("assets/images/service-bots.jpg", "Bots and automations with guardrails.", "Bots", "BOT", "thinking", 18, False),
        ("assets/images/service-app.jpg", "Product UI concepts for launch-ready tools.", "App UI", "UI", "hands", 19, False),
        ("assets/images/service-telegram.jpg", "Messaging automation and community flows.", "Messaging", "MSG", "portrait", 20, False),
        ("assets/images/service-storefront.jpg", "Storefront flows with AI-assisted checkout.", "Storefront", "SHOP", "coffee", 21, False),
        ("assets/images/service-mind-check.jpg", "Mind-check workflows for structured decisions.", "Mind Check", "CHK", "whiteboard", 22, False),
    ]
    for item in services:
        make_service(*item)

    avatars = ["portrait", "coffee", "headset", "smile", "team-laptop", "whiteboard"]
    for index, source in enumerate(avatars, start=1):
        make_avatar(f"assets/images/testimonial-{index}.jpg", source, 30 + index)
    make_daddygrab()


if __name__ == "__main__":
    main()
