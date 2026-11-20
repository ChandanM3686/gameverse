export const TAU = Math.PI * 2
export const DEG = Math.PI / 180

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value
}

export function clamp01(value) {
  return clamp(value, 0, 1)
}

export function lerp(a, b, t) {
  return a + (b - a) * t
}

export function inverseLerp(a, b, value) {
  return a === b ? 0 : clamp01((value - a) / (b - a))
}

export function remap(value, inMin, inMax, outMin, outMax) {
  return lerp(outMin, outMax, inverseLerp(inMin, inMax, value))
}

export function damp(current, target, lambda, dt) {
  return lerp(target, current, Math.exp(-lambda * dt))
}

export function dampVec(current, target, lambda, dt) {
  return current.lerp(target, 1 - Math.exp(-lambda * dt))
}

export function dampQuat(current, target, lambda, dt) {
  return current.slerp(target, 1 - Math.exp(-lambda * dt))
}

export function moveTowards(current, target, maxDelta) {
  const delta = target - current
  return Math.abs(delta) <= maxDelta
    ? target
    : current + Math.sign(delta) * maxDelta
}

export function wrap(value, min, max) {
  const span = max - min
  return min + ((((value - min) % span) + span) % span)
}

export function angleDelta(a, b) {
  return wrap(b - a, -Math.PI, Math.PI)
}

export function lerpAngle(a, b, t) {
  return a + angleDelta(a, b) * t
}

export function dampAngle(current, target, lambda, dt) {
  return current + angleDelta(current, target) * (1 - Math.exp(-lambda * dt))
}

export function deadzone(value, threshold = 0.15) {
  if (Math.abs(value) < threshold) return 0
  return Math.sign(value) * ((Math.abs(value) - threshold) / (1 - threshold))
}

export function smoothstep(t) {
  const x = clamp01(t)
  return x * x * (3 - 2 * x)
}

export function pingPong(t, length = 1) {
  return length - Math.abs(wrap(t, 0, length * 2) - length)
}

export function randRange(min, max) {
  return min + Math.random() * (max - min)
}

export function randInt(min, max) {
  return Math.floor(randRange(min, max + 1))
}

export function randSpread(magnitude = 1) {
  return (Math.random() - 0.5) * 2 * magnitude
}

export function chance(probability) {
  return Math.random() < probability
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)]
}

export function shuffle(list) {
  const out = list.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function createRandom(seed = 1) {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    spread: (magnitude = 1) => (next() - 0.5) * 2 * magnitude,
    chance: (probability) => next() < probability,
    pick: (list) => list[Math.floor(next() * list.length)],
  }
}

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => t * (2 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - (1 - t) ** 3,
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  inQuart: (t) => t ** 4,
  outQuart: (t) => 1 - (1 - t) ** 4,
  inExpo: (t) => (t === 0 ? 0 : 2 ** (10 * t - 10)),
  outExpo: (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  inBack: (t) => 2.70158 * t * t * t - 1.70158 * t * t,
  outElastic: (t) =>
    t === 0 || t === 1
      ? t
      : 2 ** (-10 * t) * Math.sin(((t * 10 - 0.75) * TAU) / 3) + 1,
  outBounce: (t) => {
    const n = 7.5625
    const d = 2.75
    if (t < 1 / d) return n * t * t
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375
    return n * (t -= 2.625 / d) * t + 0.984375
  },
}
