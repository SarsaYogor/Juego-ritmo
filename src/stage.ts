import type { Note } from './types.ts'
import type { Judge, Judgement } from './judge.ts'
import { KEYS } from './keyboard.ts'

const colors = ['#a9ee77', '#83e4ba', '#83cee0', '#beb2ee']
export const FLASH_MS = 420
export type LaneFeedback = { result: Judgement; at: number }

export function paint(
  canvas: HTMLCanvasElement,
  now: number,
  notes: Note[],
  judge: Judge | null,
  held: ReadonlyMap<number, string>,
  effects: boolean,
  palette: string[],
  flashes: ReadonlyMap<number, LaneFeedback>,
  frameTime: number,
) {
  const w = canvas.clientWidth,
    h = canvas.clientHeight
  const dpr = Math.min(2, devicePixelRatio || 1)
  if (
    canvas.width !== Math.round(w * dpr) ||
    canvas.height !== Math.round(h * dpr)
  ) {
    canvas.width = Math.round(w * dpr)
    canvas.height = Math.round(h * dpr)
  }
  const c = canvas.getContext('2d')!
  c.setTransform(dpr, 0, 0, dpr, 0, 0)
  c.clearRect(0, 0, w, h)
  if (!w || !h) return
  const center = w / 2,
    top = -h * 0.05,
    target = h * 0.82,
    depth = target - top
  const board = (z: number) => Math.min(w * 0.88, 570) * (0.4 + 0.6 * z)
  const x = (lane: number, z: number) => center + (lane / 4 - 0.5) * board(z)
  const y = (z: number) => top + depth * z
  function line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    width = 1,
  ) {
    c.strokeStyle = color
    c.lineWidth = width
    c.beginPath()
    c.moveTo(x1, y1)
    c.lineTo(x2, y2)
    c.stroke()
  }
  // Perspective lines share the same projection as playable notes and receptors.
  const tint = c.createRadialGradient(
    center,
    target * 0.7,
    0,
    center,
    target * 0.7,
    w * 0.72,
  )
  tint.addColorStop(0, (palette[0] || '#a9ee77') + '25')
  tint.addColorStop(0.6, (palette[1] || '#667577') + '24')
  tint.addColorStop(1, '#11161908')
  c.fillStyle = tint
  c.fillRect(0, 0, w, h)
  c.fillStyle = '#a5cbbb20'
  for (let py = 9; py < h; py += 19)
    for (let px = 10; px < w; px += 19) c.fillRect(px, py, 1, 1)
  for (let lane = 0; lane < 4; lane++) {
    c.beginPath()
    c.moveTo(x(lane, 0), y(0))
    c.lineTo(x(lane + 1, 0), y(0))
    c.lineTo(x(lane + 1, 1.25), y(1.25))
    c.lineTo(x(lane, 1.25), y(1.25))
    c.closePath()
    c.fillStyle = lane % 2 ? '#20272df0' : '#222a30f0'
    c.fill()
  }
  for (let lane = 0; lane <= 4; lane++)
    line(
      x(lane, 0),
      y(0),
      x(lane, 1.3),
      y(1.3),
      lane % 4 ? '#69777d69' : '#92aaa988',
      lane % 4 ? 1 : 2,
    )
  for (let i = 0; i < 10; i++) {
    const z = Math.pow(i / 9, 1.5)
    line(x(0, z), y(z), x(4, z), y(z), '#788d9230')
  }
  line(x(0, 1), target, x(4, 1), target, '#ddf6d1', 2)
  for (let lane = 0; lane < 4; lane++) {
    const width = board(1) / 4 - 8,
      xx = x(lane, 1) + 4,
      height = Math.min(42, h * 0.13),
      middle = xx + width / 2
    const flash = flashes.get(lane)
    const age = flash ? (frameTime - flash.at) / FLASH_MS : 1
    const kind = age < 1 ? flash?.result.kind : undefined
    const error = kind === 'wrong' || kind === 'miss'
    const active = held.has(lane) || !!kind
    const color = error ? '#ff9298' : kind === 'ok' ? '#f7d58c' : colors[lane]

    if (effects && kind) {
      const rise = target - Math.min(90, h * 0.21)
      const light = c.createLinearGradient(0, rise, 0, target)
      light.addColorStop(0, color + '00')
      light.addColorStop(1, color + '85')
      c.globalAlpha = (1 - age) ** 2
      c.fillStyle = light
      c.fillRect(xx, rise, width, target - rise)
      const sweepY = target - 5 - age * 42
      line(
        xx + width * age * 0.2,
        sweepY,
        xx + width * (1 - age * 0.2),
        sweepY,
        color,
        kind === 'perfect' ? 4 : 2,
      )
      c.globalAlpha = 1
    }

    c.fillStyle = active ? color : '#30383c'
    c.fillRect(xx, target + 5, width, height)
    c.fillStyle = color
    c.fillRect(xx, target + 4, width, 3)
    c.fillStyle = active ? '#161c18' : '#ecf2ef'
    c.font = 'bold 18px Consolas,monospace'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText(KEYS[lane], middle, target + 5 + height / 2)
    if (kind && width >= 38) {
      c.font = 'bold 14px "Segoe UI",sans-serif'
      c.fillText(error ? '×' : '✓', xx + width - 11, target + 5 + height / 2)
    }
  }
  for (let i = judge?.cursor ?? 0; i < notes.length; i++) {
    const n = notes[i],
      ahead = n.time - now
    if (ahead > 2.45) break
    if (judge?.resolved.has(i) || ahead < -0.13) continue
    const z = Math.pow(Math.max(0, 1 - ahead / 2.45), 1.38),
      xx = x(n.lane, z) + 4,
      yy = y(z),
      width = board(z) / 4 - 8
    c.fillStyle = colors[n.lane]
    c.shadowColor = colors[n.lane]
    c.shadowBlur = effects ? 7 : 0
    c.fillRect(xx, yy - 4, width, 4 + 5 * z)
    c.shadowBlur = 0
    c.fillStyle = '#ffffff9c'
    c.fillRect(xx, yy - 4, width, 1.5)
  }
  const fog = c.createLinearGradient(0, 0, 0, h * 0.25)
  fog.addColorStop(0, '#101519ba')
  fog.addColorStop(1, '#10151900')
  c.fillStyle = fog
  c.fillRect(0, 0, w, h * 0.25)
}
