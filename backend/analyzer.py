"""CPU-only mixed-track feature extraction, independent of the chart generator."""
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

VERSION = "mix-2"
RATE, HOP = 22050, 256
MAX_SECONDS = 600


def attack_sample(y, frame, earliest):
    """Refine a spectral candidate against the original waveform at ~3 ms resolution."""
    block = 64
    start = max(0, (earliest - 1) * HOP)
    segment = y[start:(frame + 2) * HOP]
    count = len(segment) // block
    if count < 2:
        return earliest * HOP
    levels = np.sqrt(np.mean(segment[:count * block].reshape(count, block)**2, axis=1))
    rise = np.diff(levels)
    edge = int(np.argmax(rise))
    if rise[edge] > max(.00015, .15 * levels.max()):
        return start + (edge + 1) * block
    return earliest * HOP


def analyze(path: Path):
    with sf.SoundFile(path) as source:
        if source.format != "MP3":
            raise ValueError("Selecciona un archivo MP3 válido.")
        if not 0 < len(source) / source.samplerate <= MAX_SECONDS or source.channels > 2:
            raise ValueError("Se admiten MP3 mono o estéreo de hasta 10 minutos.")
    y, sr = librosa.load(path, sr=RATE, mono=True, res_type="soxr_mq")
    duration = len(y) / sr
    # Compute a shared mel spectrogram and release each large intermediate early.
    mel = librosa.feature.melspectrogram(y=y, sr=sr, n_fft=1024, hop_length=HOP, n_mels=64)
    rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=HOP)[0]
    env = librosa.onset.onset_strength(S=librosa.power_to_db(mel, ref=np.max),
                                        sr=sr, n_fft=1024, hop_length=HOP)
    frames = librosa.onset.onset_detect(onset_envelope=env, sr=sr, hop_length=HOP)
    tempo, beat_frames = librosa.beat.beat_track(onset_envelope=env, sr=sr, hop_length=HOP)
    beats = librosa.frames_to_time(beat_frames, sr=sr, hop_length=HOP)
    tops = max(.0001, float(np.percentile(env[frames], 90))) if len(frames) else 1
    loud = max(.0001, float(np.percentile(rms, 90)))
    events = []
    for f in frames:
        # Local minimum before novelty peak gives a closer estimate of attack time.
        start = max(0, f - 3)
        attack = start + int(np.argmin(env[start:f+1]))
        energy = min(1., float(np.max(rms[attack:f+1])) / loud)
        if np.max(rms[attack:f+1]) < .00015:
            continue
        spectrum = mel[:, attack:min(f+3, mel.shape[1])].mean(axis=1)
        # Spectral centre in mel-bin units provides a stable coarse timbre family.
        center = np.average(np.arange(64), weights=np.maximum(spectrum, 1e-12))
        sample = attack_sample(y, int(f), int(attack))
        events.append(dict(time=round(sample / sr, 5), strength=min(1., float(env[f])/tops),
                           energy=energy, band=int(np.searchsorted([5, 14, 32], center))))
    return dict(version=VERSION, duration=duration, bpm=float(np.asarray(tempo).item()),
                beats=beats.round(5).tolist(), events=events)
