import hashlib
import json
import os
import re
import tempfile
from pathlib import Path
from threading import Lock

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool
from mutagen import MutagenError
import soundfile as sf

from . import analyzer, chart
from .metadata import metadata

ROOT = Path(__file__).resolve().parents[1]
DATA = Path(os.environ.get("PULSO_DATA", ROOT / ".pulso"))
DATA.mkdir(parents=True, exist_ok=True)
LIMIT = 96 * 1024**2
lock = Lock()
app = FastAPI(title="Pulso local", docs_url=None, redoc_url=None)
VERSION = f"{analyzer.VERSION}-{chart.VERSION}"


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def pack(key, name, raw):
    dest = DATA / key
    with lock:
        if dest.is_dir() and (dest / f"{VERSION}.json").is_file():
            return dict(read(dest / f"{VERSION}.json"), cached=True)
        # Publish new songs only after every file has been written successfully.
        with tempfile.TemporaryDirectory(dir=DATA) as tmp:
            stage = Path(tmp) / "song"
            stage.mkdir()
            directory = dest if dest.exists() else stage
            path = directory / "audio.mp3"
            if directory == stage:
                raw.seek(0)
                with path.open("wb") as out:
                    import shutil
                    shutil.copyfileobj(raw, out)
            analysis_path = directory / f"{analyzer.VERSION}.json"
            if analysis_path.exists():
                features = read(analysis_path)
            else:
                features = analyzer.analyze(path)
                atomic_json(analysis_path, features)
            meta = metadata(path, name, directory)
            entry = dict(id=key, **meta, duration=features["duration"], bpm=features["bpm"])
            charts = {d: chart.generate(features, d) for d in chart.RULES}
            result = dict(version=VERSION, song=entry, charts=charts)
            atomic_json(directory / f"{VERSION}.json", result)
            if directory == stage:
                stage.rename(dest)
            return dict(result, cached=False)


def atomic_json(path, data):
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, allow_nan=False), encoding="utf-8")
    tmp.replace(path)


@app.post("/api/import")
async def ingest(request: Request, name: str = "Canción.mp3"):
    if request.headers.get("content-type", "").split(";")[0] != "audio/mpeg":
        raise HTTPException(415, "Se requiere audio/mpeg.")
    digest, size = hashlib.sha256(), 0
    with tempfile.SpooledTemporaryFile(max_size=4*1024**2, dir=DATA) as raw:
        async for chunk in request.stream():
            size += len(chunk)
            if size > LIMIT:
                raise HTTPException(413, "El límite es de 96 MiB por canción.")
            digest.update(chunk)
            raw.write(chunk)
        try:
            return await run_in_threadpool(pack, digest.hexdigest(), name, raw)
        except (ValueError, sf.LibsndfileError, MutagenError) as exc:
            raise HTTPException(422, str(exc)) from exc


@app.get("/api/songs")
def library():
    return [read(p)["song"] for p in sorted(DATA.glob(f"{'[0-9a-f]'*64}/{VERSION}.json"))]


@app.get("/api/songs/{key}/{asset}")
def asset(key: str, asset: str):
    files = {"audio": ("audio.mp3", "audio/mpeg"), "cover": ("cover.jpg", "image/jpeg"),
             "level": (f"{VERSION}.json", "application/json")}
    if not re.fullmatch("[0-9a-f]{64}", key) or asset not in files:
        raise HTTPException(404)
    filename, mime = files[asset]
    path = DATA / key / filename
    if not path.is_file():
        raise HTTPException(404)
    return FileResponse(path, media_type=mime)


if (ROOT / "dist").exists():
    app.mount("/", StaticFiles(directory=ROOT / "dist", html=True), name="game")
