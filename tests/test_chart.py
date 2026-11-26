import unittest

from backend.chart import RULES, generate


def event(t, strength=1, energy=1, band=0):
    return dict(time=t, strength=strength, energy=energy, band=band)


class RulesTest(unittest.TestCase):
    def test_burst_limits_and_difficulty(self):
        features = dict(duration=20, beats=[i*.5 for i in range(40)],
                        events=[event(i*.031, band=i%4) for i in range(640)])
        counts = []
        for d, rules in RULES.items():
            notes = generate(features, d)
            self.assertEqual(notes, generate(features, d))
            counts.append(len(notes))
            last = [-5]*4
            for i, note in enumerate(notes):
                t, lane = note["time"], note["lane"]
                if i:
                    self.assertGreaterEqual(t-notes[i-1]["time"], rules.gap)
                self.assertGreaterEqual(t-last[lane], rules.repeat_gap)
                last[lane] = t
                self.assertLessEqual(sum(t<=n["time"]<t+2 for n in notes), rules.per_two_seconds)
        self.assertTrue(counts[0]<counts[1]<counts[2])

    def test_silence_syncopation_and_consistency(self):
        features = dict(duration=6, beats=[1,2,3,4], events=[event(1,energy=0),event(2.32,band=2),event(3.34,band=2)])
        self.assertEqual(generate(features,"normal"),[dict(time=2.32,lane=2),dict(time=3.34,lane=2)])
        self.assertFalse(generate(dict(duration=5,beats=[1,2,3],events=[]),"hard"))

    def test_salience_wins_and_quiet_passages_breathe(self):
        f=dict(duration=10,beats=[],events=[event(1,.5),event(1.07,1)])
        self.assertEqual(generate(f,"normal")[0]["time"],1.07)
        for e in (.18,1):
            f["events"]=[event(i*.1,energy=e) for i in range(100)]
            n=len(generate(f,"normal"))
            if e<1: quiet=n
        self.assertLess(quiet,n)
