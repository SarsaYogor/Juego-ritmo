export type Difficulty = 'easy' | 'normal' | 'hard'
export type Note = { time: number; lane: number }
export type Song = {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  bpm: number
  palette: string[]
  cover: boolean
}
export type Level = { song: Song; charts: Record<Difficulty, Note[]> }
