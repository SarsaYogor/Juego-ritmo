import chart from './demo.json'
import type { Level } from './types.ts'

export const demo: Level = {
  song: {
    id: 'demo',
    title: 'Fase Cero',
    artist: 'Pulso Studio',
    album: 'Sesiones de síntesis',
    duration: 33.6,
    bpm: 120,
    palette: ['#bbfa78', '#497d65', '#324951'],
    cover: false,
  },
  charts: chart,
}

// Original study. Every playable accent is written in the hard reference chart.
export function synthesize(ctx: AudioContext) {
  const sr = 24000,
    buffer = ctx.createBuffer(1, Math.ceil(sr * demo.song.duration), sr)
  const out = buffer.getChannelData(0)
  let seed = 17
  for (const note of chart.hard) {
    const f = [130.81, 164.81, 196, 246.94][note.lane]
    const start = Math.round(note.time * sr)
    for (let i = 0; i < sr * 0.46; i++) {
      const t = i / sr
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      const melody =
        (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(4 * Math.PI * f * t)) *
        0.29 *
        Math.exp(-8 * t)
      const kick =
        Math.sin(2 * Math.PI * (46 * t + 0.86 * (1 - Math.exp(-55 * t)))) *
        0.32 *
        Math.exp(-20 * t)
      const hat = (seed / 2 ** 31 - 1) * 0.12 * Math.exp(-60 * t)
      out[start + i] += (melody + kick + hat) * Math.min(1, t * 650)
    }
  }
  return buffer
}

export function audibleTime(ctx: AudioContext, at = performance.now()) {
  const stamp = ctx.getOutputTimestamp?.()
  if (stamp?.performanceTime && stamp.contextTime !== undefined) {
    return Math.min(
      ctx.currentTime,
      stamp.contextTime + (at - stamp.performanceTime) / 1000,
    )
  }
  return (
    ctx.currentTime -
    (ctx.outputLatency || ctx.baseLatency || 0) +
    (at - performance.now()) / 1000
  )
}
