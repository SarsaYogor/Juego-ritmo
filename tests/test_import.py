"""End-to-end local HTTP test using an original MP3 generated in a temp directory."""
import io
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request

import numpy as np
import soundfile as sf
from mutagen.id3 import ID3, TIT2, TPE1, TALB, APIC
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def reference(path):
    rate = 22050
    samples = np.zeros(18*rate, dtype=np.float32)
    tt = np.arange(int(.14*rate))/rate
    for i in range(32):
        start = int((1+i*.5)*rate)
        samples[start:start+len(tt)] = .65*np.exp(-32*tt)*np.cos(2*np.pi*(110+i%4*110)*tt)
    sf.write(path, samples, rate, format="MP3")
    tags = ID3()
    for cls, val in ((TIT2,"Referencia"),(TPE1,"Pulso"),(TALB,"Pruebas")):
        tags.add(cls(encoding=3,text=val))
    image = io.BytesIO()
    Image.new("RGB",(32,32),"#aa7733").save(image,"PNG")
    tags.add(APIC(encoding=3,mime="image/png",type=3,desc="Portada",data=image.getvalue()))
    tags.save(path)


class LocalImport(unittest.TestCase):
    def test_mp3_roundtrip(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp)/"demo.mp3"
            reference(path)
            with socket.socket() as sock:
                sock.bind(("127.0.0.1",0))
                port = sock.getsockname()[1]
            base = f"http://127.0.0.1:{port}"
            env = dict(os.environ,PULSO_DATA=str(Path(temp)/"library"),OPENBLAS_NUM_THREADS="2")
            p = subprocess.Popen([sys.executable,"-m","uvicorn","backend.app:app","--port",str(port)],
                                 cwd=ROOT,env=env,stdout=subprocess.DEVNULL)
            try:
                for _ in range(250):
                    try:
                        with urllib.request.urlopen(base+"/api/songs",timeout=1) as response:
                            self.assertEqual(json.load(response),[])
                        break
                    except urllib.error.URLError:
                        if p.poll() is not None:
                            self.fail("FastAPI terminó antes de abrir el puerto")
                        time.sleep(.2)
                def ingest(data):
                    req=urllib.request.Request(base+"/api/import?name=demo.mp3",data=data,headers={"Content-Type":"audio/mpeg"})
                    with urllib.request.urlopen(req,timeout=360) as res:
                        return json.load(res)
                raw = path.read_bytes()
                result = ingest(raw)
                self.assertFalse(result["cached"])
                song = result["song"]
                self.assertEqual((song["title"],song["artist"],song["album"]),("Referencia","Pulso","Pruebas"))
                self.assertAlmostEqual(song["bpm"],120,delta=4)
                self.assertTrue(song["cover"])
                self.assertEqual(song["palette"][0],"#aa7733")
                notes = result["charts"]["normal"]
                self.assertGreater(len(notes),20)
                errors=[min(abs(n["time"]-(1+i*.5)) for i in range(32)) for n in notes]
                self.assertLess(np.percentile(errors,90),.012)
                key = song["id"]
                stored=list((Path(env["PULSO_DATA"])/key).glob("*.json"))
                times=[x.stat().st_mtime_ns for x in stored]
                self.assertTrue(ingest(raw)["cached"])
                self.assertEqual(times,[x.stat().st_mtime_ns for x in stored])
                self.assertEqual(json.load(urllib.request.urlopen(base+"/api/songs")),[song])
                for item in ["level","audio","cover"]:
                    with urllib.request.urlopen(base+f"/api/songs/{key}/{item}") as res:
                        self.assertEqual(res.status,200)
                        if item=="audio": self.assertEqual(res.read(),raw)
                with self.assertRaises(urllib.error.HTTPError) as err: ingest(b"broken")
                self.assertEqual(err.exception.code,422)
                sf.write(path,np.zeros(22050*2,dtype=np.float32),22050,format="MP3")
                silent=ingest(path.read_bytes())
                self.assertFalse(silent["song"]["cover"])
                self.assertEqual(silent["song"]["title"],"demo")
                self.assertTrue(all(not chart for chart in silent["charts"].values()))
                print(f"MP3 de referencia: {song['bpm']:.2f} BPM, {len(notes)} notas, error p90 {np.percentile(errors,90)*1000:.1f} ms.")
            finally:
                p.terminate()
                p.wait(timeout=15)
