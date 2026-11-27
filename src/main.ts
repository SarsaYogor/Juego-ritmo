import './style.css'
import { audibleTime, demo, synthesize } from './audio.ts'
import { sleeve } from './art.ts'
import { INPUT_GRACE, Judge, WINDOW, type Judgement } from './judge.ts'
import { inputTimestamp, Keyboard, KEYS } from './keyboard.ts'
import { paint, type LaneFeedback } from './stage.ts'
import type { Difficulty, Level, Song } from './types.ts'

const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T
const fmt = (s: number) =>
  Math.floor(Math.max(0, s) / 60) +
  ':' +
  String(Math.floor(Math.max(0, s)) % 60).padStart(2, '0')
const text = (id: string, s: string) => {
  if (el(id).textContent !== s) el(id).textContent = s
}
const modal = el<HTMLDialogElement>('modal'),
  body = el('modalBody'),
  canvas = el<HTMLCanvasElement>('stage')
const demoCover = sleeve()
const keyboard = new Keyboard()
const flashes = new Map<number, LaneFeedback>()
const judgePanel = el('judge')
const feedbackLabels = {
  perfect: ['✓', 'Perfecto'],
  good: ['✓', 'Bien'],
  ok: ['✓', 'A tiempo'],
  wrong: ['×', 'Tecla incorrecta'],
  miss: ['!', 'Nota perdida'],
}
const src = (s: Song, kind: string) => '/api/songs/' + s.id + '/' + kind
const cover = (s: Song) =>
  s.id === 'demo' ? demoCover : s.cover ? src(s, 'cover') : ''
const defaults = {
  offset: 0,
  blur: 12,
  shade: 78,
  dynamic: true,
  fx: !matchMedia('(prefers-reduced-motion: reduce)').matches,
}
let prefs = { ...defaults }
try {
  Object.assign(
    prefs,
    JSON.parse(localStorage.getItem('pulso-settings') || '{}'),
  )
} catch {
  /* storage is optional */
}
let level: Level = demo,
  difficulty: Difficulty = 'normal',
  ctx: AudioContext | undefined,
  source: AudioBufferSourceNode | undefined
let session: Judge | null = null,
  start = 0,
  feedbackUntil = 0,
  pausedTime = 0,
  token = 0,
  busy = false,
  paused = false
let audioCache: { id: string; buffer: AudioBuffer } | undefined
let frame = 0

function button(label: string, handler: () => void, cls = 'action') {
  const b = document.createElement('button')
  b.textContent = label
  b.className = cls
  b.onclick = handler
  return b
}
function dialog(title: string) {
  body.replaceChildren()
  text('modalTitle', title)
  if (!modal.open) modal.showModal()
}
function detail(label: string, value: string) {
  const row = document.createElement('div'),
    b = document.createElement('b')
  row.className = 'detail'
  row.append(label, b)
  b.textContent = value
  body.append(row)
}
function para(value: string) {
  const p = document.createElement('p')
  p.textContent = value
  body.append(p)
}
function busyUI(value: boolean) {
  busy = value
  el<HTMLButtonElement>('play').disabled = value
  for (const id of ['library', 'settings', 'import'])
    el<HTMLButtonElement>(id).disabled = value || !!session
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-d]'))
    b.disabled = value || !!session
}
function applyBackground() {
  const image = cover(level.song),
    bg = el('back')
  bg.style.backgroundImage =
    prefs.dynamic && image ? 'url("' + image + '")' : 'none'
  bg.style.filter =
    'blur(' + prefs.blur + 'px) brightness(' + (100 - prefs.shade) + '%)'
  modal.style.setProperty(
    '--art',
    prefs.dynamic && image ? 'url("' + image + '")' : 'none',
  )
  modal.style.setProperty('--blur', prefs.blur + 'px')
  modal.style.setProperty('--brightness', 100 - prefs.shade + '%')
  el('cover').style.backgroundImage = image
    ? 'url("' + image + '")'
    : 'linear-gradient(130deg,#333a3d,#181d21)'
}
function selection() {
  const s = level.song
  text('songTitle', s.title)
  text('artist', s.artist)
  text('length', fmt(s.duration))
  el('tags').replaceChildren(
    ...[
      (s.bpm ? Math.round(s.bpm) : '—') + ' BPM',
      fmt(s.duration),
      level.charts[difficulty].length + ' notas',
    ].map((v) => {
      const t = document.createElement('span')
      t.textContent = v
      return t
    }),
  )
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-d]')) {
    const active = b.dataset.d === difficulty
    b.classList.toggle('chosen', active)
    b.setAttribute('aria-pressed', String(active))
  }
  applyBackground()
  draw()
}
function clock(at?: number) {
  return ctx ? audibleTime(ctx, at) - start - prefs.offset / 1000 : 0
}
function feedback(result: Judgement) {
  const at = performance.now()
  flashes.set(result.lane, { result, at })
  feedbackUntil = at + 560
  const [icon, label] = feedbackLabels[result.kind]
  judgePanel.dataset.kind = result.kind
  text('judgeIcon', icon)
  text('judgeLabel', label)
  let detail = 'Carril ' + KEYS[result.lane]
  if ('deltaMs' in result) {
    const delta = result.deltaMs
    detail +=
      ' · ' + (delta > 0 ? '+' : delta < 0 ? '−' : '') + Math.abs(delta) + ' ms'
  } else if (result.kind === 'wrong') {
    detail += ' · −180 pts'
  }
  text('judgeDetail', detail)
}
function clearFeedback() {
  keyboard.clear()
  flashes.clear()
  feedbackUntil = 0
}
function draw() {
  cancelAnimationFrame(frame)
  const t = session ? (paused ? pausedTime : clock()) : 0,
    notes = level.charts[difficulty]
  if (session && !paused) {
    session.advanceFrame(t)
    if (
      t >
      Math.max(
        level.song.duration,
        (notes.at(-1)?.time || 0) + WINDOW + INPUT_GRACE,
      ) +
        0.03
    ) {
      finish()
      return
    }
  }
  const frameTime = performance.now()
  paint(
    canvas,
    session ? t : (notes[0]?.time || 0) - 0.18,
    notes,
    session,
    keyboard.held,
    prefs.fx,
    prefs.dynamic ? level.song.palette : demo.song.palette,
    flashes,
    frameTime,
  )
  text('score', String(session?.points ?? 0).padStart(6, '0'))
  text('combo', (session?.combo ?? 0) + '×')
  text(
    'accuracy',
    session?.accuracy != null ? session.accuracy.toFixed(1) + '%' : '—',
  )
  text('miss', String((session?.misses ?? 0) + (session?.ghosts ?? 0)))
  text('elapsed', fmt(t))
  el<HTMLProgressElement>('progress').value = Math.min(
    1,
    Math.max(0, t / level.song.duration),
  )
  judgePanel.hidden = !session || paused || frameTime >= feedbackUntil
  if (session && !paused) frame = requestAnimationFrame(draw)
}
function reset() {
  token++
  session = null
  paused = false
  clearFeedback()
  if (source) {
    source.stop()
    source.disconnect()
    source = undefined
  }
  text('state', 'EN ESPERA')
  text('playText', 'Jugar')
  busyUI(false)
  draw()
}
function finish() {
  const result = session!
  reset()
  dialog('Resultado')
  para(
    level.song.title +
      ' · ' +
      { easy: 'Fácil', normal: 'Normal', hard: 'Difícil' }[difficulty],
  )
  detail('Puntuación', String(result.points))
  detail('Precisión', (result.accuracy ?? 0).toFixed(1) + ' %')
  detail('Mejor combo', result.best + '×')
  detail('Notas acertadas', result.hits + ' / ' + result.notes.length)
  detail('Notas perdidas', String(result.misses))
  detail('Teclas incorrectas', String(result.ghosts))
  body.append(
    button(
      'Volver a jugar',
      () => {
        modal.close()
        void play()
      },
      'primary',
    ),
  )
}
async function play() {
  if (busy) return
  if (session) {
    await pause()
    return
  }
  if (!level.charts[difficulty].length) {
    text(
      'message',
      'Sin ataques suficientes en esta dificultad. Prueba otra canción o dificultad.',
    )
    return
  }
  const id = ++token
  busyUI(true)
  text('message', '')
  text('playText', 'Preparando…')
  try {
    ctx ??= new AudioContext({ latencyHint: 'interactive' })
    await ctx.resume()
    if (audioCache?.id !== level.song.id) {
      let buffer
      if (level.song.id === 'demo') buffer = synthesize(ctx)
      else {
        const r = await fetch(src(level.song, 'audio'))
        if (!r.ok) throw Error('No se pudo abrir el MP3 local.')
        buffer = await ctx.decodeAudioData(await r.arrayBuffer())
      }
      audioCache = { id: level.song.id, buffer }
    }
    if (id !== token) return
    session = new Judge(level.charts[difficulty], feedback)
    source = ctx.createBufferSource()
    source.buffer = audioCache.buffer
    source.connect(ctx.destination)
    start = ctx.currentTime + 1.6
    source.start(start)
    clearFeedback()
    text('state', 'EN JUEGO')
    text('playText', 'Pausar')
    draw()
  } catch (e) {
    reset()
    text('message', errorText(e))
  } finally {
    busyUI(false)
  }
}
async function pause() {
  if (!session || paused || !ctx) return
  pausedTime = clock()
  paused = true
  clearFeedback()
  draw()
  await ctx.suspend()
  text('state', 'EN PAUSA')
  dialog('Partida en pausa')
  body.append(
    button('Continuar', () => modal.close(), 'primary'),
    button('Volver a la sala', () => {
      reset()
      modal.close()
    }),
  )
}
modal.addEventListener('close', async () => {
  if (paused && ctx && session) {
    await ctx.resume()
    paused = false
    text('state', 'EN JUEGO')
    draw()
  }
})
function settings() {
  if (session) {
    void pause()
    return
  }
  dialog('Ajustes')
  const persist = () => {
    try {
      localStorage.setItem('pulso-settings', JSON.stringify(prefs))
    } catch {}
    applyBackground()
    draw()
  }
  function slider(
    key: 'offset' | 'blur' | 'shade',
    label: string,
    min: number,
    max: number,
    unit: string,
  ) {
    const l = document.createElement('label'),
      i = document.createElement('input'),
      v = document.createElement('output')
    i.type = 'range'
    i.min = String(min)
    i.max = String(max)
    i.value = String(prefs[key])
    i.setAttribute('aria-label', label)
    v.textContent = i.value + ' ' + unit
    l.append(label, v)
    body.append(l, i)
    i.oninput = () => {
      prefs[key] = +i.value
      v.textContent = i.value + ' ' + unit
      persist()
    }
  }
  slider('offset', 'Desfase de entrada', -300, 300, 'ms')
  para(
    'Si pulsas al oír el golpe y llegas tarde, aumenta el desfase. Usa Fase Cero para calibrarlo.',
  )
  slider('blur', 'Desenfoque del fondo', 0, 30, 'px')
  slider('shade', 'Oscurecimiento', 35, 95, '%')
  for (const [key, label] of [
    ['dynamic', 'Fondo y paleta de la portada'],
    ['fx', 'Destellos y brillo de notas'],
  ] as const) {
    const l = document.createElement('label'),
      i = document.createElement('input')
    i.type = 'checkbox'
    i.checked = prefs[key]
    l.append(label, i)
    body.append(l)
    i.onchange = () => {
      prefs[key] = i.checked
      persist()
    }
  }
}
function errorText(e: unknown) {
  return e instanceof Error ? e.message : 'No se pudo completar la operación.'
}
async function library() {
  if (session) {
    void pause()
    return
  }
  dialog('Biblioteca')
  const visit = ++token
  function entry(s: Song) {
    const b = button(
      '',
      async () => {
        if (busy) return
        busyUI(true)
        try {
          if (s.id === 'demo') level = demo
          else {
            const r = await fetch(src(s, 'level'))
            if (!r.ok) throw Error('No se pudo abrir el nivel.')
            level = await r.json()
          }
          selection()
          text('message', '')
          modal.close()
        } catch (e) {
          text('message', errorText(e))
          modal.close()
        } finally {
          busyUI(false)
        }
      },
      'entry',
    )
    const art = cover(s),
      info = document.createElement('span'),
      sub = document.createElement('small')
    if (art) {
      const i = document.createElement('img')
      i.src = art
      i.alt = ''
      b.append(i)
    } else {
      const tile = document.createElement('span')
      tile.className = 'tile'
      b.append(tile)
    }
    info.textContent = s.title
    sub.textContent = [s.artist, s.album, fmt(s.duration)]
      .filter(Boolean)
      .join(' · ')
    info.append(sub)
    b.append(info)
    body.append(b)
  }
  entry(demo.song)
  try {
    const r = await fetch('/api/songs')
    if (!r.ok) throw Error()
    const list: Song[] = await r.json()
    if (
      visit === token &&
      modal.open &&
      el('modalTitle').textContent === 'Biblioteca'
    )
      list.forEach(entry)
  } catch {
    if (
      visit === token &&
      modal.open &&
      el('modalTitle').textContent === 'Biblioteca'
    )
      para('Inicia el servidor local para ver tus MP3 importados.')
  }
}
async function importFile(file: File) {
  if (file.size > 96 * 1024 ** 2) {
    text('message', 'El límite es de 96 MiB por canción.')
    return
  }
  busyUI(true)
  text(
    'message',
    'Analizando en este equipo. La primera importación puede tardar varios minutos…',
  )
  try {
    const r = await fetch('/api/import?name=' + encodeURIComponent(file.name), {
      method: 'POST',
      headers: { 'Content-Type': 'audio/mpeg' },
      body: file,
    })
    if (!r.ok) {
      const err = await r.json().catch(() => ({}))
      throw Error(
        err.detail || 'Comprueba que el servidor FastAPI está en ejecución.',
      )
    }
    const data = await r.json()
    level = data
    audioCache = undefined
    selection()
    text(
      'message',
      data.cached
        ? 'Nivel recuperado de la caché.'
        : 'Análisis completado. Nivel guardado.',
    )
  } catch (e) {
    text('message', 'Error de importación. ' + errorText(e))
  } finally {
    busyUI(false)
  }
}
el('play').onclick = () => void play()
el('import').onclick = () => {
  if (session) {
    void pause()
    return
  }
  el('file').click()
}
el<HTMLInputElement>('file').onchange = (e) => {
  const i = e.target as HTMLInputElement
  if (i.files?.[0]) void importFile(i.files[0])
  i.value = ''
}
el('close').onclick = () => modal.close()
el('settings').onclick = settings
el('library').onclick = () => void library()
el('room').onclick = () => {
  if (modal.open) modal.close()
}
el('difficulties').onclick = (e) => {
  const d = (e.target as HTMLElement).dataset.d as Difficulty
  if (d && !session && !busy) {
    difficulty = d
    text('message', '')
    selection()
  }
}
window.addEventListener('keydown', (e) => {
  if (modal.open || !session || paused) return
  if (e.key === 'Escape' || e.code === 'Escape') {
    e.preventDefault()
    void pause()
    return
  }
  const input = keyboard.press(e)
  if (!input) return
  e.preventDefault()
  if (input.repeated) return
  const t = clock(inputTimestamp(e.timeStamp))
  if (t >= -WINDOW) session.press(input.lane, t)
})
window.addEventListener('keyup', (e) => keyboard.release(e))
window.addEventListener('blur', () => {
  if (session) void pause()
})
document.addEventListener('visibilitychange', () => {
  if (document.hidden && session) void pause()
})
new ResizeObserver(draw).observe(canvas)
selection()
