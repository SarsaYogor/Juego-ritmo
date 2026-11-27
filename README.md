# Pulso

Juego de ritmo local para teclado. Incluye **Fase Cero**, una pieza de síntesis original de 33,6 segundos y 120 BPM con mapas escritos a mano. Permite comprobar el motor antes de importar música. El código, los mapas de referencia y la portada generativa se distribuyen bajo la licencia MIT.

## Empezar a jugar

**Edición portátil para Windows x64.** Descarga `Pulso-Windows-x64.zip` desde [Releases](https://github.com/SarsaYogor/Juego-ritmo/releases), extrae el archivo completo y abre `Pulso.exe`. Incluye el juego compilado, CPython y el análisis de MP3. El lanzador utiliza .NET Framework 4.x de Windows y abre la sala en el navegador en `http://127.0.0.1:8765`. Al cerrar la consola se detiene la aplicación. Para llevar tus canciones a otro equipo, mueve la carpeta extraída entera, incluida `Biblioteca`.

**Versión web.** FastAPI sirve la interfaz de `dist/` y los endpoints que importan y analizan música. La edición portátil los ejecuta en el mismo equipo que el navegador. Un alojamiento estático de `dist/` permite jugar a la demo. La importación completa requiere el backend de Python.

Para reconstruir el ZIP en Windows, utiliza el entorno CPython 3.12 x64 preparado con `requirements-lock.txt`, el frontend compilado y el compilador de .NET Framework 4.x. Desde la raíz del proyecto ejecuta `python portable/construir.py Pulso-Windows-x64.zip`. El script copia el intérprete, la biblioteca estándar y los paquetes fijados en una carpeta aislada y compila el lanzador. El ZIP excluye las canciones y los ajustes del equipo de compilación.

### Desde el código fuente

Clona el repositorio y compila el frontend con Node.js 22.12 o posterior. En PowerShell puedes usar `npm.cmd` en lugar de `npm` si tu equipo restringe los scripts de PowerShell.

```sh
git clone https://github.com/SarsaYogor/Juego-ritmo.git
cd Juego-ritmo
npm ci --dry-run --engine-strict
npm ci --engine-strict
npm run build
```

Configura el entorno Python desde la misma carpeta. La instalación inicial descarga paquetes públicos. A partir de ahí, la reproducción, el análisis, la extracción de portadas, la biblioteca y los ajustes funcionan sin conexión.

### Windows x64 · PowerShell

Instala CPython 3.12 de 64 bits si aún no está disponible. Comprueba la versión y ejecuta la resolución de paquetes antes de instalarlos.

```powershell
py -3.12 -V
py -3.12 -m venv .venv
.\.venv\Scripts\python -m pip install --dry-run --only-binary=:all: -r requirements-lock.txt
.\.venv\Scripts\python -m pip install --only-binary=:all: -r requirements-lock.txt
.\.venv\Scripts\python -m pip check
.\.venv\Scripts\python jugar.py
```

### Linux x86-64 · Bash

Usa CPython 3.12 con el módulo venv. Se comprobó la disponibilidad de ruedas para Linux con glibc 2.39. El paso de resolución comprueba la compatibilidad con tu distribución concreta.

```bash
python3.12 -V
python3.12 -m venv .venv
.venv/bin/python -m pip install --dry-run --only-binary=:all: -r requirements-lock.txt
.venv/bin/python -m pip install --only-binary=:all: -r requirements-lock.txt
.venv/bin/python -m pip check
.venv/bin/python jugar.py
```

La sala se abre en **http://127.0.0.1:8000**. Conserva la terminal abierta mientras juegas. Ctrl+C detiene el servidor. Si el puerto está ocupado, ejecuta `python -m uvicorn backend.app:app --host 127.0.0.1 --port 8010` con el intérprete del entorno y abre ese puerto en el navegador. Usa un único proceso de backend por biblioteca.

### Controles

1. Selecciona **Fácil**, **Normal** o **Difícil** y pulsa **Jugar**. Hay 1,6 s de entrada antes del inicio del audio.
2. Pulsa **D, F, J y K** cuando la nota toque la línea clara de su carril. El receptor marca el carril pulsado y muestra un ✓ al acertar o una × al fallar. El aviso indica la diferencia en milisegundos en cada acierto. Un valor negativo indica que te adelantaste y uno positivo que llegaste tarde. **Esc** pausa. Salir de la pestaña también pausa el reloj y el audio.
3. Usa **Importar MP3** para analizar un archivo. **Biblioteca** recupera las pistas guardadas, con título, artista, álbum y portada si existen.
4. En **Ajustes** puedes cambiar el desfase entre −300 y +300 ms. Si pulsas al oír el golpe y el juego registra una pulsación tardía, aumenta el valor. La corrección desplaza la línea temporal tanto para dibujar como para juzgar. El navegador recuerda los ajustes por origen. Puedes desactivar los destellos y el brillo y seguir viendo el resultado de cada pulsación.

### Desarrollo del frontend

Se probó Node 24.22.0 y npm 11.19.1. `package-lock.json` fija las versiones. Para modificar TypeScript, Canvas o la interfaz, inicia FastAPI desde la raíz y, en otra terminal de la misma carpeta, ejecuta estos comandos.

```sh
node --version
npm ci --dry-run --engine-strict
npm ci --engine-strict
npm run dev
```

Vite indica la dirección de desarrollo y reenvía `/api` al puerto 8000. En PowerShell puedes usar `npm.cmd` si se bloquean los scripts .ps1. `npm run build` comprueba los tipos y reconstruye `dist/`. Si iniciaste FastAPI antes de la primera compilación, reinícialo para servir el juego compilado.

## Arquitectura

| Módulo | Responsabilidad |
| --- | --- |
| `src/audio.ts`, `src/demo.json` | Síntesis original, tres mapas predefinidos y lectura del reloj audible de Web Audio. |
| `src/judge.ts` | Juicio por carril, ventanas de acierto, combo, puntuación y penalizaciones. Funciona sin Canvas ni acceso al DOM. |
| `src/keyboard.ts` | Asigna los caracteres D, F, J y K a los carriles, gestiona pulsaciones simultáneas y normaliza sus marcas de tiempo. |
| `src/stage.ts` | Proyección de cuatro carriles en Canvas 2D y dibujo del tramo visible. |
| `src/main.ts` | Importación, biblioteca, ajustes, ciclo de partida y pausa. |
| `backend/analyzer.py` | Librosa y SoundFile extraen BPM, pulsos y candidatos a nota de la mezcla mono a 22.050 Hz. |
| `backend/chart.py` | Función determinista que transforma las características en notas para una dificultad. Solo depende de la biblioteca estándar de Python. |
| `backend/metadata.py` | Mutagen lee TIT2, TPE1, TALB y APIC. Pillow reduce la portada a JPEG y extrae hasta tres colores predominantes. |
| `backend/app.py` | API local de FastAPI, validación del audio, caché por contenido y servicio de archivos. |

El analizador devuelve un diccionario con `version`, `duration`, `bpm`, `beats` y `events`. Cada evento lleva su tiempo en segundos, relevancia del ataque (`strength`), intensidad relativa (`energy`) y familia tímbrica (`band`, 0–3). Relevancia e intensidad van de 0 a 1. Los niveles JSON contienen `version`, `song` y `charts`. Cada dificultad contiene notas ordenadas como `{"time": 2.32, "lane": 1}`. Un nuevo analizador puede producir ese mismo contrato y reutilizar tanto el generador como el motor.

### Generación musical

Librosa estima la envolvente de ataques en un espectrograma mel compartido con el análisis de timbre. El sistema mide el RMS y refina los ataques con flanco claro sobre bloques de 64 muestras de la forma de onda. Asigna una familia por el centro de energía espectral. Solo los ataques con evidencia acústica pasan a la selección.

El generador pondera cada candidato con **55 % de fuerza de ataque, 27 % de intensidad y 18 % de proximidad a un pulso o a su punto medio**. Conserva la posición temporal del ataque. Recorre los candidatos por prioridad y reserva espacio para los acentos fuertes. La intensidad local reduce el presupuesto de notas en pasajes suaves.

| Dificultad | Intervalo mínimo | Mismo dedo | Máximo en cualquier ventana de 2 s | Umbral de selección |
| --- | ---: | ---: | ---: | ---: |
| Fácil | 340 ms | 540 ms | 4 | 0,50 |
| Normal | 210 ms | 340 ms | 7 | 0,38 |
| Difícil | 130 ms | 230 ms | 10 | 0,25 |

Cada instante contiene como máximo una nota. Cada timbre conserva un carril preferente. Entre los carriles disponibles, el uso de las ocho notas recientes favorece los menos utilizados y reparte las secuencias repetitivas entre ambas manos. Esta versión deja silencios y puede devolver un mapa vacío si la pieza carece de ataques adecuados.

### Sincronización y puntuación

El audio decodificado empieza en un instante programado de `AudioContext`. Las posiciones se calculan en segundos absolutos. `requestAnimationFrame` solicita el dibujo y `getOutputTimestamp()` relaciona la salida de audio con la marca temporal del evento del teclado. En navegadores que carecen de esa lectura se usa el reloj del contexto con la latencia comunicada por el dispositivo.

Los márgenes de ±45, ±85 y ±125 ms dan 100, 75 y 45 puntos. El dibujo espera 45 ms adicionales antes de declarar una nota perdida, para dar tiempo a que lleguen las pulsaciones encoladas con su marca temporal original. El margen para acertar sigue siendo de ±125 ms. Una tecla sin nota válida resta 180 puntos al saldo interno y rompe el combo. El marcador visible tiene un mínimo de cero. La precisión divide el crédito ponderado por los aciertos, notas perdidas y pulsaciones incorrectas. Se ignora la repetición automática del teclado. Los receptores y las notas conservan sus colores con cualquier portada.

### Archivos y API local

- `POST /api/import?name=archivo.mp3` recibe el cuerpo binario con `Content-Type: audio/mpeg`. Devuelve las tres dificultades y el indicador `cached`.
- `GET /api/songs` lista las canciones disponibles para la versión activa.
- `GET /api/songs/{sha256}/level`, `/audio` y `/cover` recuperan el JSON, el MP3 y el JPEG respectivamente. La portada solo existe si se pudo extraer una imagen válida.
- La biblioteca vive en `.pulso/<sha256>/`. Guarda una copia del MP3 para poder reproducirlo al volver a abrir el juego, la portada procesada, el análisis y los mapas. El original se abre en lectura. La variable `PULSO_DATA` admite otra ubicación.
- Dos importaciones del mismo contenido comparten caché aunque cambie el nombre del archivo. El análisis se ejecuta en un hilo y se serializa para moderar el consumo de RAM. Cada canción nueva se publica mediante un renombrado al completar todos sus archivos.
- Para cambiar las reglas o el analizador, aumenta el `VERSION` del módulo correspondiente. Si cambia el generador, basta con abrir la canción en la biblioteca para regenerar sus niveles con el análisis guardado. Si cambia el analizador, reimporta el MP3 para generar las características de la nueva versión.

## Pruebas y resultados

Desde la carpeta del proyecto, con el entorno Python activo y las dependencias de desarrollo de Node instaladas, ejecuta lo siguiente.

```sh
python -m pip check
python -m unittest discover -s tests -v
npm test
npm run build
```

- **Cinco pruebas Python** cubren los cuatro carriles, límites por dedo, relevancia, variación de intensidad, silencios y síncopas. La integración HTTP comprueba la importación, portadas, actualización de niveles anteriores sin volver a analizar, contenidos dañados y un MP3 silencioso sin portada.
- **Siete pruebas del motor** comprueban los mapas predefinidos, el juicio absoluto, las teclas encoladas, la detección por carácter, la repetición automática y las penalizaciones. Pulsar los cuatro carriles en cada instante del mapa difícil produce cero puntos y un 25 % de precisión.
- **Referencia temporal**. En el MP3 de 120 BPM, la estimación fue 120,19 BPM y el nivel normal conservó los 32 golpes. El percentil 90 del error absoluto fue 2,3 ms al comparar los tiempos de las notas con los golpes originales. La primera implementación adelantaba los ataques de la referencia hasta un error p90 de 32,4 ms. El refinamiento de forma de onda y una prueba de regresión con límite de 12 ms cubren ese caso.
- **Rendimiento observado**. En Windows con Intel Core Ultra 5 125U, una mezcla sintética estéreo de 180 s a 44,1 kHz tardó 7,71 s en analizarse y generar las tres dificultades con la compilación de Numba ya preparada. Se obtuvieron 240, 449 y 632 notas. La medida excluye transferencia, portada, reproducción y escritura de caché.
- **Navegador**. Se comprobó la partida de demostración, el avance del transporte, el registro de una tecla incorrecta, la pausa, la reanudación y la pantalla de resultados. El navegador integrado denegó el permiso de automatización del selector de archivos. La importación se verificó por la API HTTP real. Edge sin interfaz también bloqueó el inicio de la sesión de pruebas automatizada en este entorno.
- **Compatibilidad**. Se resolvieron dependencias binarias antes de instalarlas en CPython 3.12.14 x64 y `pip check` terminó sin conflictos. Se comprobó en el índice de PyPI que los 41 paquetes fijados ofrecían ruedas compatibles con CPython 3.12 y Linux x86-64 con glibc 2.39. Queda pendiente ejecutar la aplicación en un equipo Linux.

## Límites del prototipo

Las fases 1–3 están implementadas. El análisis trabaja con la mezcla completa. **Demucs, la selección de batería/bajo/voz/otros y Spotify Basic Pitch quedan para las fases 4–6**. Una futura integración podrá analizar el stem elegido y conservar el MP3 original como reloj maestro de reproducción. La tonalidad melódica y las frases vocales sostenidas requieren análisis adicional.

Se admiten MP3 mono o estéreo de hasta 10 minutos y 96 MiB. Se analiza una canción a la vez y el navegador decodifica la pista completa al jugar. La primera importación puede tardar más debido a Numba. El detector puede confundir medio tempo y doble tempo, omitir ataques suaves o clasificar de forma parecida instrumentos superpuestos. La afinación musical con repertorios variados y la latencia física de altavoces, Bluetooth y teclado requieren pruebas de escucha. La medición sobre la señal sintética describe únicamente esa referencia.

### Referencias técnicas

[Librosa 0.11.0](https://pypi.org/project/librosa/0.11.0/) · [Numba 0.61.2](https://pypi.org/project/numba/0.61.2/) · [SoundFile 0.13.1](https://pypi.org/project/soundfile/0.13.1/) · [Guía de Vite](https://vite.dev/guide/).
