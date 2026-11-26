from io import BytesIO
from pathlib import Path

from mutagen.mp3 import MP3
from PIL import Image, ImageOps, UnidentifiedImageError

NEUTRAL = ["#a9f275", "#7e9183", "#303931"]


def metadata(path, name, directory):
    tags = MP3(path).tags or {}
    def value(key, fallback):
        return str(tags.get(key, "")).strip()[:300] or fallback
    result = dict(title=value("TIT2", Path(name).stem or "Sin título"),
                  artist=value("TPE1", "Artista desconocido"), album=value("TALB", ""),
                  palette=NEUTRAL, cover=False)
    frames = tags.getall("APIC") if tags else []
    for frame in sorted(frames, key=lambda f: f.type != 3):
        if len(frame.data) > 12 * 1024**2:
            continue
        try:
            with Image.open(BytesIO(frame.data)) as image:
                if image.width * image.height > 16_000_000:
                    continue
                image.thumbnail((1024, 1024))
                cover = ImageOps.exif_transpose(image).convert("RGB")
                thumb = cover.resize((64, 64)).quantize(colors=3)
                colors = thumb.getpalette()
                result["palette"] = ["#%02x%02x%02x" % tuple(colors[i*3:i*3+3])
                                     for _, i in sorted(thumb.getcolors(), reverse=True)]
                cover.save(directory / "cover.jpg", quality=85)
                result["cover"] = True
                break
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
            continue
    return result
