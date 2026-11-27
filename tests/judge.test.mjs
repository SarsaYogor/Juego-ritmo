import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Judge } from '../src/judge.ts'
import { inputTimestamp, Keyboard, KEYS } from '../src/keyboard.ts'
const charts = JSON.parse(
  readFileSync(new URL('../src/demo.json', import.meta.url), 'utf8'),
)

test('Los tres mapas predefinidos consiguen un 100 % con su reloj de referencia', () => {
  for (const notes of Object.values(charts)) {
    const j = new Judge(notes)
    for (const n of notes) j.press(n.lane, n.time)
    j.advance(100)
    assert.equal(j.accuracy, 100)
    assert.equal(j.misses, 0)
    assert.equal(j.best, notes.length)
    assert.equal(j.points, notes.length * 100)
  }
})
test('Pulsar los cuatro carriles en cada golpe no da puntos', () => {
  const j = new Judge(charts.hard)
  for (const n of charts.hard)
    for (let lane = 0; lane < 4; lane++) j.press(lane, n.time)
  assert.equal(j.points, 0)
  assert.equal(j.ghosts, charts.hard.length * 3)
  assert.equal(j.accuracy, 25)
})
test('Ventanas, duplicados, omisión y tecla ajena', () => {
  const results = []
  const j = new Judge(
    [
      { time: 1, lane: 0 },
      { time: 2, lane: 1 },
      { time: 3, lane: 2 },
    ],
    (result) => results.push(result),
  )
  j.press(0, 0.94)
  assert.equal(j.points, 75)
  j.press(0, 1)
  j.press(3, 2)
  j.advance(2.13)
  j.press(2, 3.11)
  assert.deepEqual(results, [
    { kind: 'good', lane: 0, deltaMs: -60 },
    { kind: 'wrong', lane: 0 },
    { kind: 'wrong', lane: 3 },
    { kind: 'miss', lane: 1 },
    { kind: 'ok', lane: 2, deltaMs: 110 },
  ])
  assert.deepEqual([j.hits, j.ghosts, j.misses, j.best], [2, 2, 1, 1])
})
test('Un fotograma adelantado deja pasar una tecla encolada sin ampliar el margen', () => {
  const j = new Judge([
    { time: 1, lane: 3 },
    { time: 2, lane: 2 },
  ])
  j.advanceFrame(1.16)
  j.press(3, 1.125)
  assert.equal(j.hits, 1)
  j.advanceFrame(2.16)
  j.press(2, 2.126)
  assert.deepEqual([j.hits, j.misses, j.ghosts], [1, 1, 1])
})
test('D F J K se leen por carácter, se mantienen independientemente y se pueden volver a pulsar', () => {
  const keyboard = new Keyboard()
  const events = KEYS.map((key, lane) => ({
    key: key.toLowerCase(),
    code: 'Key' + ['H', 'B', 'C', 'V'][lane],
  }))
  for (const [lane, event] of events.entries())
    assert.deepEqual(keyboard.press(event), { lane, repeated: false })
  assert.equal(keyboard.held.size, 4)
  assert.deepEqual(keyboard.press({ ...events[2], repeat: true }), {
    lane: 2,
    repeated: true,
  })
  assert.equal(keyboard.press({ key: 'x', code: 'KeyJ' }), null)
  assert.equal(keyboard.press({ ...events[3], ctrlKey: true }), null)
  keyboard.release({ key: 'J', code: 'KeyC' })
  assert.deepEqual(keyboard.press(events[2]), { lane: 2, repeated: false })
  keyboard.clear()
  assert.deepEqual(keyboard.press({ key: 'Unidentified', code: 'KeyK' }), {
    lane: 3,
    repeated: false,
  })
})
test('Las marcas temporales antiguas por época y las ausentes usan el reloj correcto', () => {
  const origin = 1_700_000_000_000
  assert.equal(inputTimestamp(origin + 125, 150, origin), 125)
  assert.equal(inputTimestamp(125, 150, origin), 125)
  assert.equal(inputTimestamp(0, 150, origin), 150)
  assert.equal(inputTimestamp(170, 150, origin), 150)
})
test('El juicio usa tiempo absoluto y admite corrección de entrada tardía', () => {
  const j = new Judge([
    { time: 1, lane: 1 },
    { time: 120, lane: 3 },
  ])
  j.press(1, 1.17 - 0.17)
  j.advance(119.9)
  j.press(3, 120.17 - 0.17)
  assert.equal(j.accuracy, 100)
})
