#!/usr/bin/env python3
"""
Generates assets/feature-graphic.png (1024x500, Play Store feature graphic).

"Signal in the dark" concept: a near-black cinematic background, a huge
ghosted copy of the app icon as background texture, a route line that stops
and radiates a glowing radar pulse (the crash-detection moment) as the
dominant visual, and the wordmark + tagline in Inter (the app's own font,
pulled straight from node_modules/@expo-google-fonts/inter) bottom-left.

Pure PIL/numpy — no external rendering API.
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1024, 500
ACCENT = (255, 87, 34)  # #FF5722 — the app's actual accent (theme/colors.ts, assets/icon.png)
BG = (5, 7, 13)         # near-black, deep-space dark
WHITE = (255, 255, 255)

FONT_DIR = "node_modules/@expo-google-fonts/inter"
FONT_BOLD = f"{FONT_DIR}/800ExtraBold/Inter_800ExtraBold.ttf"
FONT_LIGHT = f"{FONT_DIR}/300Light/Inter_300Light.ttf"


def draw_tracked_text(draw, xy, text, font, fill, tracking=0.0):
    """PIL has no built-in letter-spacing, so advance manually per glyph."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        w = draw.textlength(ch, font=font)
        x += w + tracking
    return x


def icon_glyph_paths(cx, cy, r):
    """Returns (ring bbox, pulse points) for the app icon's ring+heartbeat glyph, scaled to radius r."""
    ring_bbox = (cx - r, cy - r, cx + r, cy + r)
    # Pulse zigzag proportions lifted from the real icon.png geometry.
    pts = [
        (cx - r * 0.75, cy),
        (cx - r * 0.42, cy),
        (cx - r * 0.22, cy - r * 0.58),
        (cx + r * 0.02, cy + r * 0.58),
        (cx + r * 0.25, cy - r * 0.20),
        (cx + r * 0.75, cy - r * 0.20),
    ]
    return ring_bbox, pts


def main():
    base = Image.new("RGB", (W, H), BG)

    # ---- subtle vignette: faint lift near center, darker at corners ----
    vign = Image.new("L", (W, H), 0)
    vd = ImageDraw.Draw(vign)
    vd.ellipse((W * 0.15, -H * 0.6, W * 0.95, H * 1.6), fill=40)
    vign = vign.filter(ImageFilter.GaussianBlur(180))
    lift = Image.new("RGB", (W, H), (14, 18, 28))
    base = Image.composite(lift, base, vign)

    # ---- ghosted giant icon texture, low opacity, behind everything ----
    ghost_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(ghost_layer)
    gcx, gcy, gr = 700, 230, 430
    ring_bbox, pulse_pts = icon_glyph_paths(gcx, gcy, gr)
    ghost_alpha = 26  # ~10%
    gd.ellipse(ring_bbox, outline=(WHITE[0], WHITE[1], WHITE[2], ghost_alpha), width=26)
    gd.line(pulse_pts, fill=(WHITE[0], WHITE[1], WHITE[2], ghost_alpha + 8), width=22, joint="curve")
    base = Image.alpha_composite(base.convert("RGBA"), ghost_layer).convert("RGB")

    # ---- dominant centerpiece: route line that stops + radar pulse ----
    centerpiece = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    cd = ImageDraw.Draw(centerpiece)

    pulse_origin = (676, 224)

    # angular route line, muted, leading to the pulse point
    route = [(486, 356), (556, 322), (596, 274), pulse_origin]
    cd.line(route, fill=(210, 218, 232, 110), width=4, joint="curve")
    # small waypoint ticks along the route
    for px, py in route[:-1]:
        cd.ellipse((px - 4, py - 4, px + 4, py + 4), fill=(210, 218, 232, 130))

    # soft bloom glow beneath the rings (big blurred filled circle)
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gld = ImageDraw.Draw(glow)
    gld.ellipse(
        (pulse_origin[0] - 150, pulse_origin[1] - 150, pulse_origin[0] + 150, pulse_origin[1] + 150),
        fill=(ACCENT[0], ACCENT[1], ACCENT[2], 90),
    )
    glow = glow.filter(ImageFilter.GaussianBlur(55))
    centerpiece = Image.alpha_composite(centerpiece, glow)
    cd = ImageDraw.Draw(centerpiece)

    # expanding radar rings, fading outward
    ring_specs = [(16, 255), (40, 180), (68, 120), (100, 70), (136, 36)]
    for radius, alpha in ring_specs:
        cd.ellipse(
            (pulse_origin[0] - radius, pulse_origin[1] - radius, pulse_origin[0] + radius, pulse_origin[1] + radius),
            outline=(ACCENT[0], ACCENT[1], ACCENT[2], alpha),
            width=3,
        )

    # hot core dot
    cd.ellipse(
        (pulse_origin[0] - 9, pulse_origin[1] - 9, pulse_origin[0] + 9, pulse_origin[1] + 9),
        fill=(ACCENT[0], ACCENT[1], ACCENT[2], 255),
    )
    cd.ellipse(
        (pulse_origin[0] - 3.5, pulse_origin[1] - 3.5, pulse_origin[0] + 3.5, pulse_origin[1] + 3.5),
        fill=(255, 255, 255, 255),
    )

    base = Image.alpha_composite(base.convert("RGBA"), centerpiece).convert("RGB")

    # ---- wordmark + tagline, bottom-left ----
    draw = ImageDraw.Draw(base)
    angel_font = ImageFont.truetype(FONT_BOLD, 92)
    tagline_font = ImageFont.truetype(FONT_LIGHT, 32)

    text_x = 72
    angel_y = 336
    draw_tracked_text(draw, (text_x, angel_y), "Angel", angel_font, WHITE, tracking=3.0)

    tagline_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    td = ImageDraw.Draw(tagline_layer)
    draw_tracked_text(
        td, (text_x + 2, angel_y + 108), "Your ride. Protected.", tagline_font,
        (255, 255, 255, 102), tracking=0.8,
    )
    base = Image.alpha_composite(base.convert("RGBA"), tagline_layer).convert("RGB")

    # ---- film grain, ~5% opacity ----
    rng = np.random.default_rng(7)
    noise = rng.integers(0, 255, (H, W), dtype=np.uint8)
    noise_img = Image.fromarray(noise, mode="L").convert("RGB")
    base = Image.blend(base, noise_img, 0.05)

    base.save("assets/feature-graphic.png", "PNG")
    print("saved", base.size, base.mode)


if __name__ == "__main__":
    main()
