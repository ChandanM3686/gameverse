import * as THREE from "three"

import { clamp01, ease } from "./math.js"

export function createTweens(engine = null) {
  const active = new Set()

  function step(dt) {
    for (const tween of active) {
      tween.elapsed += dt
      if (tween.elapsed < tween.delay) continue

      const t = clamp01((tween.elapsed - tween.delay) / tween.duration)
      const eased = tween.ease(t)
      const done = t >= 1

      for (const key of tween.keys) {
        const { from, to } = tween.values[key]
        if (typeof to === "number") {
          tween.target[key] = done ? to : from + (to - from) * eased
        } else if (to.isColor || to.isVector3 || to.isVector2) {
          if (done) tween.target[key].copy(to)
          else tween.target[key].copy(from).lerp(to, eased)
        }
      }

      tween.onUpdate?.(eased, tween.target)

      if (done) {
        active.delete(tween)
        tween.onComplete?.(tween.target)
        tween.resolve?.(tween.target)
      }
    }
  }

  const manager = {
    to(target, props, options = {}) {
      const {
        duration = 0.3,
        delay = 0,
        ease: curve = ease.outCubic,
        onUpdate,
        onComplete,
      } = options

      const values = {}
      for (const [key, to] of Object.entries(props)) {
        const current = target[key]
        values[key] =
          typeof to === "number"
            ? { from: current, to }
            : { from: current.clone(), to: to.clone ? to.clone() : to }
      }

      const tween = {
        target,
        values,
        keys: Object.keys(values),
        duration: Math.max(duration, 1e-6),
        delay,
        ease: curve,
        elapsed: 0,
        onUpdate,
        onComplete,
      }
      active.add(tween)

      const promise = new Promise((resolve) => {
        tween.resolve = resolve
      })
      promise.stop = () => active.delete(tween)
      return promise
    },

    from(target, props, options = {}) {
      const destination = {}
      for (const key of Object.keys(props)) {
        const current = target[key]
        destination[key] =
          typeof current === "number" ? current : current.clone()
        target[key] = props[key]
      }
      return manager.to(target, destination, options)
    },

    value(from, to, options = {}) {
      return manager.to({ v: from }, { v: to }, options)
    },

    wait(seconds) {
      return manager.value(0, 1, { duration: seconds, ease: ease.linear })
    },

    stopAll() {
      active.clear()
    },

    step,
  }

  if (engine) engine.onUpdate(step)
  return manager
}

export class Spring {
  constructor(options = {}) {
    const { stiffness = 180, damping = 18, value = 0 } = options
    this.stiffness = stiffness
    this.damping = damping
    this.value = value
    this.target = value
    this.velocity = 0
  }

  impulse(amount) {
    this.velocity += amount
    return this
  }

  update(dt) {
    const steps = Math.max(1, Math.ceil(dt * 120))
    const h = dt / steps
    for (let i = 0; i < steps; i++) {
      const force =
        -this.stiffness * (this.value - this.target) -
        this.damping * this.velocity
      this.velocity += force * h
      this.value += this.velocity * h
    }
    return this.value
  }
}

export class SpringVec3 {
  constructor(options = {}) {
    this.x = new Spring(options)
    this.y = new Spring(options)
    this.z = new Spring(options)
  }

  setTarget(vector) {
    this.x.target = vector.x
    this.y.target = vector.y
    this.z.target = vector.z
    return this
  }

  update(dt, out = new THREE.Vector3()) {
    return out.set(this.x.update(dt), this.y.update(dt), this.z.update(dt))
  }
}

export function createShake(object, options = {}) {
  const { decay = 5, frequency = 30 } = options
  const base = object.position.clone()
  let amount = 0
  let time = 0

  return {
    add(strength = 0.3) {
      amount = Math.max(amount, strength)
    },
    update(dt) {
      if (amount <= 0.0001) return
      time += dt * frequency
      object.position.x += Math.sin(time * 1.7) * amount
      object.position.y += Math.sin(time * 2.3 + 1.7) * amount
      object.position.z += Math.sin(time * 1.1 + 3.4) * amount * 0.5
      amount *= Math.exp(-decay * dt)
    },
    reset() {
      amount = 0
      object.position.copy(base)
    },
  }
}

export function flash(object, options = {}) {
  const { color = "#ffffff", duration = 0.12, intensity = 1 } = options
  const targets = []
  object.traverse((child) => {
    if (!child.isMesh || !child.material?.emissive) return
    targets.push({
      material: child.material,
      color: child.material.emissive.clone(),
      intensity: child.material.emissiveIntensity,
    })
    child.material.emissive.set(color)
    child.material.emissiveIntensity = intensity
  })

  setTimeout(() => {
    for (const entry of targets) {
      entry.material.emissive.copy(entry.color)
      entry.material.emissiveIntensity = entry.intensity
    }
  }, duration * 1000)

  return object
}

export function pop(object, tweens, options = {}) {
  const { scale = 1.25, duration = 0.24 } = options
  const base = object.scale.clone()
  object.scale.set(base.x * scale, base.y / scale, base.z * scale)
  return tweens.to(
    object.scale,
    { x: base.x, y: base.y, z: base.z },
    {
      duration,
      ease: ease.outElastic,
    }
  )
}

export function hover(object, options = {}) {
  const {
    amplitude = 0.15,
    speed = 2,
    spin = 0.6,
    phase = Math.random() * 10,
  } = options
  const baseY = object.position.y
  return (dt, elapsed) => {
    object.position.y = baseY + Math.sin((elapsed + phase) * speed) * amplitude
    object.rotation.y += spin * dt
  }
}

export function createMixer(model, clips, engine = null) {
  const mixer = new THREE.AnimationMixer(model)
  const actions = new Map()
  let current = null

  for (const clip of clips ?? []) {
    actions.set(clip.name, mixer.clipAction(clip))
  }

  const api = {
    mixer,
    actions,
    get playing() {
      return current
    },
    names: () => [...actions.keys()],

    play(name, options = {}) {
      const { fade = 0.25, loop = true, speed = 1 } = options
      const next = actions.get(name)
      if (!next || next === actions.get(current)) return api

      next.reset()
      next.timeScale = speed
      next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity)
      next.clampWhenFinished = !loop

      const previous = actions.get(current)
      if (previous && fade > 0) previous.crossFadeTo(next, fade, true)
      next.play()
      current = name
      return api
    },

    stop(name) {
      actions.get(name ?? current)?.fadeOut(0.2)
      if (!name || name === current) current = null
    },

    update: (dt) => mixer.update(dt),
    dispose: () => mixer.stopAllAction(),
  }

  if (engine) engine.onUpdate(api.update)
  return api
}

export { ease }
