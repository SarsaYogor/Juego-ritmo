import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Judge } from '../src/judge.ts'
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
  const j = new Judge([
    { time: 1, lane: 0 },
    { time: 2, lane: 1 },
    { time: 3, lane: 2 },
  ])
  j.press(0, 0.94)
  assert.equal(j.points, 75)
  j.press(0, 1)
  j.press(3, 2)
  j.advance(2.13)
  j.press(2, 3.11)
  assert.equal(j.label, 'A tiempo')
  assert.deepEqual([j.hits, j.ghosts, j.misses, j.best], [2, 2, 1, 1])
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
