"""Launch the compiled game on loopback. Run with the project Python environment."""
import json
from pathlib import Path
import socket
import sys
from threading import Thread
import time
import urllib.error
import urllib.request
import webbrowser

import uvicorn

ROOT = Path(__file__).resolve().parent
URL = "http://127.0.0.1:8000"


def running():
    try:
        with urllib.request.urlopen(URL + "/openapi.json", timeout=1) as response:
            return json.load(response).get("info", {}).get("title") == "Pulso local"
    except (OSError, ValueError):
        return False


def open_when_ready():
    for _ in range(100):
        if running():
            webbrowser.open(URL)
            return
        time.sleep(.2)


if __name__ == "__main__":
    if running():
        webbrowser.open(URL)
        sys.exit(0)
    if not (ROOT / "dist/index.html").is_file():
        sys.exit("Compila el frontend con npm ci y npm run build.")
    with socket.socket() as sock:
        if sock.connect_ex(("127.0.0.1", 8000)) == 0:
            sys.exit("El puerto 8000 está ocupado. Consulta la guía de ejecución.")
    Thread(target=open_when_ready, daemon=True).start()
    uvicorn.run("backend.app:app", host="127.0.0.1", port=8000, app_dir=str(ROOT))
