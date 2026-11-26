// An original generative record sleeve. No external image or font assets.
export function sleeve() {
  const c = document.createElement('canvas')
  c.width = c.height = 540
  const g = c.getContext('2d')!
  const back = g.createLinearGradient(0, 0, 540, 540)
  back.addColorStop(0, '#233a42')
  back.addColorStop(0.55, '#101e2a')
  back.addColorStop(1, '#314339')
  g.fillStyle = back
  g.fillRect(0, 0, 540, 540)
  let seed = 41
  for (let i = 0; i < 12000; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const x = seed % 540,
      y = (seed >>> 13) % 540
    g.fillStyle = i % 3 ? '#c7f3b616' : '#00000030'
    g.fillRect(x, y, 1, 1)
  }
  for (let ring = 0; ring < 120; ring++) {
    const v = ring / 119
    g.beginPath()
    for (let j = 0; j <= 240; j++) {
      const t = (j * Math.PI) / 120
      const rad =
        115 + 47 * Math.cos(v * Math.PI * 2) + 23 * Math.sin(3 * t + v * 4)
      const x = rad * Math.cos(t),
        y =
          rad * Math.sin(t) * 0.43 +
          77 * Math.sin(v * Math.PI * 2) +
          25 * Math.sin(2 * t + v * 4)
      const a = -0.58,
        px = 265 + 1.25 * (x * Math.cos(a) - y * Math.sin(a)),
        py = 274 + 1.25 * (x * Math.sin(a) + y * Math.cos(a))
      if (j === 0) g.moveTo(px, py)
      else g.lineTo(px, py)
    }
    g.strokeStyle =
      'hsla(' +
      (163 - 77 * v) +
      ',78%,' +
      (38 + 38 * v) +
      '%,' +
      (0.42 + 0.46 * v) +
      ')'
    g.lineWidth = 1.4
    g.stroke()
  }
  g.fillStyle = '#def0d5'
  g.font = 'bold 16px monospace'
  g.fillText('PULSO  /  PS—001', 28, 42)
  g.font = 'bold 33px sans-serif'
  g.fillText('FASE CERO', 28, 505)
  return c.toDataURL()
}
