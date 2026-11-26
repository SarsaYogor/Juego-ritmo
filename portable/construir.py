"""Build a relocatable Windows x64 release from the project's locked environment."""
from importlib import metadata
from pathlib import Path
import os
import shutil
import struct
import subprocess
import sys
import sysconfig
from tempfile import TemporaryDirectory
from zipfile import ZIP_DEFLATED, ZipFile

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parent


def copy_packages(runtime):
    target = runtime / "packages"
    for entry in (PROJECT / "requirements-lock.txt").read_text().splitlines():
        name, version = entry.split("==")
        package = metadata.distribution(name)
        if package.version != version:
            raise RuntimeError(f"{name} requiere {version}. Encontrado {package.version}.")
        for record in package.files or ():
            if ".." in record.parts or "__pycache__" in record.parts:
                continue
            file = Path(package.locate_file(record))
            if file.suffix == ".pyc" or not file.is_file():
                continue
            dest = target / record
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(file, dest)


def build(output):
    if (sysconfig.get_platform(), sys.version_info[:2], struct.calcsize("P")) != ("win-amd64", (3, 12), 8):
        sys.exit("Ejecuta este script con el entorno CPython 3.12 de Windows x64.")
    base = Path(sys.base_prefix)
    compiler = Path(os.environ["WINDIR"]) / "Microsoft.NET/Framework64/v4.0.30319/csc.exe"
    if not compiler.is_file() or not (PROJECT / "dist/index.html").is_file():
        sys.exit("Se necesita el compilador de .NET Framework 4.x y el frontend compilado en dist.")
    output.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix="pulso-build-") as tmp:
        root = Path(tmp) / "Pulso"
        runtime = root / "runtime"
        runtime.mkdir(parents=True)
        for pattern in ("python.exe", "python3*.dll", "vcruntime*.dll", "LICENSE.txt"):
            for file in base.glob(pattern):
                shutil.copyfile(file, runtime / file.name)
        shutil.copytree(base / "DLLs", runtime / "DLLs")
        ignored = shutil.ignore_patterns("site-packages", "__pycache__", "test", "idlelib", "ensurepip")
        shutil.copytree(base / "Lib", runtime / "Lib", ignore=ignored)
        copy_packages(runtime)
        # The scikit-learn wheel redistributes MSVC/OpenMP. Other extensions
        # (including soxr and Numba) may load before scikit-learn adds its DLL path.
        for dll in ("msvcp140.dll", "vcomp140.dll"):
            shutil.copyfile(runtime / "packages/sklearn/.libs" / dll, runtime / dll)
        (runtime / "python312._pth").write_text(".\nDLLs\nLib\npackages\n../app\n", encoding="ascii")
        app = root / "app"
        shutil.copytree(PROJECT / "backend", app / "backend", ignore=shutil.ignore_patterns("__pycache__"))
        shutil.copytree(PROJECT / "dist", app / "dist")
        shutil.copyfile(HERE / "portable.py", app / "portable.py")
        shutil.copyfile(PROJECT / "LICENSE", root / "LICENSE")
        shutil.copyfile(HERE / "LEEME.txt", root / "LEEME.txt")
        subprocess.run([str(compiler), "/nologo", "/target:exe", "/platform:x64",
                        "/optimize+", f"/out:{root / 'Pulso.exe'}", str(HERE / "Pulso.cs")], check=True)
        with ZipFile(output.with_suffix(".tmp"), "w", compression=ZIP_DEFLATED, compresslevel=5) as archive:
            for file in sorted(root.rglob("*")):
                if file.is_file():
                    archive.write(file, file.relative_to(root.parent))
        output.with_suffix(".tmp").replace(output)
    print(output)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("Uso: python portable/construir.py ruta/Pulso-Windows-x64.zip")
    build(Path(sys.argv[1]).resolve())
