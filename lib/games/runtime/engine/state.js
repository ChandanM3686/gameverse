export function createEvents() {
  const listeners = new Map()

  return {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event).add(handler)
      return () => listeners.get(event)?.delete(handler)
    },
    once(event, handler) {
      const off = this.on(event, (...args) => {
        off()
        handler(...args)
      })
      return off
    },
    emit(event, ...args) {
      for (const handler of [...(listeners.get(event) ?? [])]) handler(...args)
    },
    off(event) {
      listeners.delete(event)
    },
  }
}

export function createStateMachine(states, initial, engine = null) {
  let current = null
  let elapsed = 0
  const events = createEvents()

  const machine = {
    states,
    on: events.on,
    get current() {
      return current
    },
    get time() {
      return elapsed
    },
    is: (name) => current === name,

    go(name, payload) {
      if (name === current) return machine
      if (!states[name]) throw new Error(`No such state: ${name}`)
      states[current]?.exit?.(payload, machine)
      const previous = current
      current = name
      elapsed = 0
      states[name].enter?.(payload, machine)
      events.emit("change", name, previous)
      return machine
    },

    update(dt) {
      elapsed += dt
      states[current]?.update?.(dt, machine)
    },
  }

  if (engine) engine.onUpdate(machine.update)
  if (initial) machine.go(initial)
  return machine
}

export function createScore(options = {}) {
  const { key = "best", initial = 0, hud = null, label = "Score" } = options
  const store = createStorage(key)

  let value = initial
  let best = store.get("best", 0)
  const events = createEvents()

  const display = hud?.stat(label, initial)
  const bestDisplay = hud?.stat("Best", best, { at: "top-right" })

  const score = {
    on: events.on,
    get value() {
      return value
    },
    get best() {
      return best
    },
    add(amount = 1) {
      return score.set(value + amount)
    },
    set(next) {
      value = next
      display?.set(value)
      if (value > best) {
        best = value
        bestDisplay?.set(best)
        store.set("best", best)
        events.emit("best", best)
      }
      events.emit("change", value)
      return score
    },
    reset() {
      value = initial
      display?.set(value)
      events.emit("change", value)
      return score
    },
  }

  return score
}

export function createStorage(namespace = "game") {
  const prefix = `${namespace}:`

  return {
    get(key, fallback = null) {
      try {
        const raw = localStorage.getItem(prefix + key)
        return raw === null ? fallback : JSON.parse(raw)
      } catch {
        return fallback
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(prefix + key, JSON.stringify(value))
      } catch {}
      return value
    },
    remove(key) {
      try {
        localStorage.removeItem(prefix + key)
      } catch {}
    },
    clear() {
      try {
        for (const key of Object.keys(localStorage)) {
          if (key.startsWith(prefix)) localStorage.removeItem(key)
        }
      } catch {}
    },
  }
}

export function createTimer(options = {}) {
  const {
    duration = null,
    hud = null,
    label = "Time",
    onEnd = null,
    format,
  } = options
  const display = hud?.stat(label, duration ?? 0, {
    at: "top-center",
    format: format ?? formatTime,
    bump: false,
  })

  let time = duration ?? 0
  let running = true

  return {
    get time() {
      return time
    },
    get done() {
      return duration !== null && time <= 0
    },
    start() {
      running = true
    },
    pause() {
      running = false
    },
    reset(to = duration ?? 0) {
      time = to
      display?.set(time)
    },
    add(seconds) {
      time += seconds
      display?.set(time)
    },
    update(dt) {
      if (!running) return
      time += duration === null ? dt : -dt
      if (duration !== null && time <= 0) {
        time = 0
        running = false
        onEnd?.()
      }
      display?.set(time)
    },
  }
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(total / 60)
  return `${minutes}:${String(total % 60).padStart(2, "0")}`
}

export function createDifficulty(options = {}) {
  const { rampSeconds = 90, curve = (t) => t ** 0.7, max = 1 } = options
  let elapsed = 0

  return {
    get level() {
      return Math.min(max, curve(Math.min(1, elapsed / rampSeconds)) * max)
    },
    between(from, to) {
      return from + (to - from) * this.level
    },
    update(dt) {
      elapsed += dt
    },
    reset() {
      elapsed = 0
    },
  }
}

export function createTicker(interval, callback) {
  let accumulated = 0
  return {
    interval,
    update(dt) {
      accumulated += dt
      let fired = 0
      while (accumulated >= this.interval && fired < 8) {
        accumulated -= this.interval
        callback()
        fired++
      }
      if (fired >= 8) accumulated = 0
    },
    reset() {
      accumulated = 0
    },
  }
}

export function createCooldown(seconds) {
  let remaining = 0
  return {
    get remaining() {
      return remaining
    },
    get progress() {
      return 1 - remaining / seconds
    },
    ready: () => remaining <= 0,
    use() {
      remaining = seconds
    },
    update(dt) {
      if (remaining > 0) remaining = Math.max(0, remaining - dt)
    },
  }
}
