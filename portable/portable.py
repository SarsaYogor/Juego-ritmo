"""Entry point for the extracted Windows edition."""
import hashlib
import multiprocessing
import os
from pathlib import Path
import socket
import sys
import urllib.error
import urllib.request
import webbrowser
from contextlib import asynccontextmanager

ROOT = Path(__file__).resolve().parents[1]
URL = "http://127.0.0.1:8765"
INSTANCE = hashlib.sha256(os.fsencode(os.path.normcase(ROOT))).hexdigest()


def launch():
    os.environ["PULSO_DATA"] = str(ROOT / "Biblioteca")
    os.environ["NUMBA_CACHE_DIR"] = str(ROOT / "Cache")
    show = "--sin-navegador" not in sys.argv

    with socket.socket() as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        try:
            sock.bind(("127.0.0.1", 8765))
        except OSError:
            try:
                with urllib.request.urlopen(URL + "/api/portable", timeout=2) as res:
                    same = res.read(100) == INSTANCE.encode("ascii")
            except OSError:
                same = False
            if same:
                if show:
                    webbrowser.open(URL)
                return
            sys.exit("El puerto 8765 está ocupado. Cierra la otra instancia y vuelve a abrir Pulso.")

        import uvicorn
        from fastapi.responses import PlainTextResponse
        from backend.app import app

        # Register the identity route before the catch-all static mount.
        from starlette.routing import Route

        async def identity(request):
            return PlainTextResponse(INSTANCE)

        app.router.routes.insert(0, Route("/api/portable", identity))

        @asynccontextmanager
        async def lifespan(_app):
            print(f"Pulso está listo en {URL}\nCierra esta ventana para salir.", flush=True)
            if show:
                webbrowser.open(URL)
            yield

        app.router.lifespan_context = lifespan
        sock.listen()
        config = uvicorn.Config(app, host="127.0.0.1", port=8765)
        uvicorn.Server(config).run(sockets=[sock])


if __name__ == "__main__":
    multiprocessing.freeze_support()
    launch()
