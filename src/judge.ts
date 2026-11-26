import type { Note } from './types.ts'

export const WINDOW = 0.125
export class Judge {
  readonly notes: Note[]
  readonly resolved = new Set<number>()
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
  label = ''
  constructor(notes: Note[]) {
    this.notes = notes
  }

  advance(time: number) {
    while (
      this.cursor < this.notes.length &&
      this.notes[this.cursor].time < time - WINDOW
    ) {
      if (!this.resolved.has(this.cursor)) {
        this.misses++
        this.combo = 0
        this.label = 'Fallo'
      }
      this.cursor++
    }
  }

  press(lane: number, time: number) {
    this.advance(time)
    let target = -1
    let delta = WINDOW + 1e-9
    for (let i = this.cursor; i < this.notes.length; i++) {
      const n = this.notes[i]
      if (n.time > time + WINDOW) break
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
      this.label = 'Tecla incorrecta'
      return
    }
    this.resolved.add(target)
    const quality = delta <= 0.045 ? 1 : delta <= 0.085 ? 0.75 : 0.45
    this.credit += quality
    this.hits++
    this.combo++
    this.best = Math.max(this.best, this.combo)
    this.balance += Math.round(100 * quality)
    this.label =
      quality === 1 ? 'Perfecto' : quality === 0.75 ? 'Bien' : 'A tiempo'
  }

  get accuracy() {
    const total = this.hits + this.misses + this.ghosts
    return total ? (100 * this.credit) / total : null
  }
}
