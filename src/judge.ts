import type { Note } from './types.ts'

export const WINDOW = 0.125
// Leave queued key events a brief chance to use their original timestamps.
export const INPUT_GRACE = 0.045
const EPSILON = 1e-9

export type Judgement =
  | { kind: 'perfect' | 'good' | 'ok'; lane: number; deltaMs: number }
  | { kind: 'wrong' | 'miss'; lane: number }

export class Judge {
  readonly notes: Note[]
  readonly resolved = new Set<number>()
  private readonly onJudgement: (result: Judgement) => void
  cursor = 0
  private balance = 0
  get points() {
    return Math.max(0, this.balance)
  }
  combo = 0
  best = 0
  misses = 0
  ghosts = 0
  hits = 0
  credit = 0
  constructor(
    notes: Note[],
    onJudgement: (result: Judgement) => void = () => {},
  ) {
    this.notes = notes
    this.onJudgement = onJudgement
  }

  advanceFrame(time: number) {
    this.advance(time - INPUT_GRACE)
  }

  advance(time: number) {
    while (
      this.cursor < this.notes.length &&
      time - this.notes[this.cursor].time > WINDOW + EPSILON
    ) {
      const note = this.notes[this.cursor]
      if (!this.resolved.delete(this.cursor)) {
        this.misses++
        this.combo = 0
        this.onJudgement({ kind: 'miss', lane: note.lane })
      }
      this.cursor++
    }
  }

  press(lane: number, time: number) {
    this.advance(time)
    let target = -1
    let delta = Infinity
    for (let i = this.cursor; i < this.notes.length; i++) {
      const n = this.notes[i]
      if (n.time - time > WINDOW + EPSILON) break
      const dist = Math.abs(n.time - time)
      if (n.lane === lane && !this.resolved.has(i) && dist < delta) {
        target = i
        delta = dist
      }
    }
    if (target < 0) {
      this.ghosts++
      this.combo = 0
      this.balance -= 180
      this.onJudgement({ kind: 'wrong', lane })
      return
    }
    this.resolved.add(target)
    const kind =
      delta <= 0.045 + EPSILON
        ? 'perfect'
        : delta <= 0.085 + EPSILON
          ? 'good'
          : 'ok'
    const quality = kind === 'perfect' ? 1 : kind === 'good' ? 0.75 : 0.45
    this.credit += quality
    this.hits++
    this.combo++
    this.best = Math.max(this.best, this.combo)
    this.balance += Math.round(100 * quality)
    this.onJudgement({
      kind,
      lane,
      deltaMs: Math.round((time - this.notes[target].time) * 1000),
    })
  }

  get accuracy() {
    const total = this.hits + this.misses + this.ghosts
    return total ? (100 * this.credit) / total : null
  }
}
