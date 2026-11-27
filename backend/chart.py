"""Deterministic chart generation. Times in seconds, lanes numbered left to right."""
from bisect import bisect_left, insort
from dataclasses import dataclass


@dataclass(frozen=True)
class Rules:
    gap: float
    repeat_gap: float
    per_two_seconds: int
    threshold: float


RULES = {
    "easy": Rules(.34, .54, 4, .50),
    "normal": Rules(.21, .34, 7, .38),
    "hard": Rules(.13, .23, 10, .25),
}
VERSION = "rules-2"


def grid_distance(time, beats):
    i = bisect_left(beats, time)
    nearby = beats[max(0, i - 1):i + 1]
    if len(nearby) == 2:
        nearby = [*nearby, sum(nearby) / 2]
    if not nearby:
        return 1.0
    return min(abs(time - b) for b in nearby)


def generate(features, difficulty):
    rules = RULES[difficulty]
    beats = features["beats"]
    candidates = []
    for e in features["events"]:
        t, energy = e["time"], e["energy"]
        if energy < .025 or not 0 <= t < features["duration"]:
            continue
        grid = max(0, 1 - grid_distance(t, beats) / .075)
        rank = .55 * e["strength"] + .27 * energy + .18 * grid
        if rank >= rules.threshold:
            candidates.append((-rank, t, e["band"], energy))

    # Select strong accents before weaker neighbours, independent of frame order.
    times, accepted = [], {}
    for _, t, band, energy in sorted(candidates):
        i = bisect_left(times, t)
        if any(abs(n - t) < rules.gap for n in times[max(0, i-1):i+1]):
            continue
        cap = max(2, round(rules.per_two_seconds * (.50 + .50 * energy)))
        local = times[bisect_left(times, t-2):bisect_left(times, t+2)]
        insort(local, t)
        if any(local[j+cap] - local[j] < 2 for j in range(len(local)-cap)):
            continue
        times.insert(i, t)
        accepted[t] = band

    last = [float("-inf")] * 4
    recent = []
    notes = []
    for t in times:
        home = accepted[t]
        # Prefer the timbre's home lane. Repeated accents gradually migrate
        # across both hands, even when every event has the same timbre.
        preference = {home: 0, home ^ 2: 4, home ^ 1: 5, home ^ 3: 6}
        available = (lane for lane in range(4) if t - last[lane] >= rules.repeat_gap)
        lane = min(available, key=lambda lane: (preference[lane] + 3 * recent.count(lane), last[lane]))
        last[lane] = t
        recent = [*recent[-7:], lane]
        notes.append({"time": t, "lane": lane})
    return notes
