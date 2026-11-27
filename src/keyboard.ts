export const KEYS = ['D', 'F', 'J', 'K']

type Key = Pick<KeyboardEvent, 'key' | 'code'>
type KeyDown = Key &
  Pick<
    KeyboardEvent,
    'repeat' | 'isComposing' | 'ctrlKey' | 'altKey' | 'metaKey'
  >

function physicalKey({ code, key }: Key) {
  return code && code !== 'Unidentified' ? code : key.toUpperCase()
}

export class Keyboard {
  readonly held = new Map<number, string>()

  press(event: KeyDown) {
    if (event.isComposing || event.ctrlKey || event.altKey || event.metaKey)
      return null

    const lane = KEYS.findIndex((key) =>
      !event.key || event.key === 'Unidentified'
        ? event.code === 'Key' + key
        : event.key.toUpperCase() === key,
    )
    if (lane < 0) return null

    const identity = physicalKey(event)
    const repeated =
      event.repeat ||
      this.held.has(lane) ||
      [...this.held.values()].includes(identity)
    if (!repeated) this.held.set(lane, identity)
    return { lane, repeated }
  }

  release(event: Key) {
    const identity = physicalKey(event)
    for (const [lane, key] of this.held)
      if (key === identity) this.held.delete(lane)
  }

  clear() {
    this.held.clear()
  }
}

export function inputTimestamp(
  stamp: number,
  now = performance.now(),
  origin = performance.timeOrigin,
) {
  if (stamp >= origin) stamp -= origin
  return stamp > 0 && stamp <= now ? stamp : now
}
