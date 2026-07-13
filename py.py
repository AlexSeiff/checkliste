from pathlib import Path
from PIL import Image, ImageDraw

Path("icons").mkdir(exist_ok=True)

for size in (192, 512):
    s = size / 512  # Skalierungsfaktor
    img = Image.new("RGB", (size, size), "#2456e6")
    d = ImageDraw.Draw(img)
    d.line(
        [(130 * s, 265 * s), (225 * s, 360 * s), (385 * s, 165 * s)],
        fill="white",
        width=int(52 * s),
        joint="curve",
    )
    img.save(f"icons/icon-{size}.png")

print("Icons erstellt: icons/icon-192.png und icons/icon-512.png")