import * as THREE from "three"

import { deadzone } from "./math.js"

const DEFAULT_ACTIONS = {
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  up: ["KeyW", "ArrowUp"],
  down: ["KeyS", "ArrowDown"],
  jump: ["Space"],
  fire: ["Mouse0", "Enter"],
  sprint: ["ShiftLeft", "ShiftRight"],
  crouch: ["ControlLeft", "KeyC"],
  pause: ["Escape", "KeyP"],
  restart: ["KeyR"],
}

export function createInput(options = {}) {
  const {
    engine = null,
    target = window,
    element = engine?.canvas ?? document.body,
    actions = {},
    touchStick = true,
  } = options

  const bindings = { ...DEFAULT_ACTIONS, ...actions }

  const held = new Set()
  const justPressed = new Set()
  const justReleased = new Set()

  const input = {
    move: new THREE.Vector2(),
    look: new THREE.Vector2(),
    pointer: new THREE.Vector2(),
    pointerPixels: new THREE.Vector2(),
    wheel: 0,
    pointerDown: false,
    locked: false,
    touch: matchMedia?.("(pointer: coarse)").matches ?? false,
    gamepadIndex: null,
  }

  const codesFor = (name) => bindings[name] ?? [name]

  input.down = (name) => codesFor(name).some((code) => held.has(code))
  input.pressed = (name) => codesFor(name).some((code) => justPressed.has(code))
  input.released = (name) =>
    codesFor(name).some((code) => justReleased.has(code))
  input.axis = (negative, positive) =>
    (input.down(positive) ? 1 : 0) - (input.down(negative) ? 1 : 0)
  input.bind = (name, codes) => {
    bindings[name] = codes
  }
  input.codes = (name) => bindings[name]

  input.press = (code) => {
    if (!held.has(code)) justPressed.add(code)
    held.add(code)
  }
  input.release = (code) => {
    held.delete(code)
    justReleased.add(code)
  }

  function onKeyDown(event) {
    if (
      ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
        event.code
      )
    ) {
      event.preventDefault()
    }
    if (event.repeat) return
    if (!held.has(event.code)) justPressed.add(event.code)
    held.add(event.code)
  }

  function onKeyUp(event) {
    held.delete(event.code)
    justReleased.add(event.code)
  }

  function onBlur() {
    for (const code of held) justReleased.add(code)
    held.clear()
  }

  target.addEventListener("keydown", onKeyDown)
  target.addEventListener("keyup", onKeyUp)
  window.addEventListener("blur", onBlur)

  function updatePointer(event) {
    const rect = element.getBoundingClientRect()
    input.pointerPixels.set(event.clientX - rect.left, event.clientY - rect.top)
    input.pointer.set(
      (input.pointerPixels.x / rect.width) * 2 - 1,
      -(input.pointerPixels.y / rect.height) * 2 + 1
    )
  }

  function onPointerDown(event) {
    updatePointer(event)
    const code = `Mouse${event.button}`
    if (!held.has(code)) justPressed.add(code)
    held.add(code)
    input.pointerDown = true
    element.setPointerCapture?.(event.pointerId)
  }

  function onPointerUp(event) {
    const code = `Mouse${event.button}`
    held.delete(code)
    justReleased.add(code)
    input.pointerDown = held.has("Mouse0")
    element.releasePointerCapture?.(event.pointerId)
  }

  function onPointerMove(event) {
    updatePointer(event)
    input.look.x += event.movementX ?? 0
    input.look.y += event.movementY ?? 0
  }

  function onWheel(event) {
    event.preventDefault()
    input.wheel += Math.sign(event.deltaY)
  }

  function onContextMenu(event) {
    event.preventDefault()
  }

  element.addEventListener("pointerdown", onPointerDown)
  element.addEventListener("pointerup", onPointerUp)
  element.addEventListener("pointermove", onPointerMove)
  element.addEventListener("pointercancel", onPointerUp)
  element.addEventListener("wheel", onWheel, { passive: false })
  element.addEventListener("contextmenu", onContextMenu)

  function onLockChange() {
    input.locked = document.pointerLockElement === element
  }
  document.addEventListener("pointerlockchange", onLockChange)

  input.requestPointerLock = () => element.requestPointerLock?.()
  input.exitPointerLock = () => document.exitPointerLock?.()

  const stick = { active: false, id: null, originX: 0, originY: 0, x: 0, y: 0 }
  const STICK_RADIUS = 64

  function onTouchStart(event) {
    if (!touchStick) return
    for (const touch of event.changedTouches) {
      if (stick.active) break
      const rect = element.getBoundingClientRect()
      if (touch.clientX - rect.left > rect.width / 2) continue
      stick.active = true
      stick.id = touch.identifier
      stick.originX = touch.clientX
      stick.originY = touch.clientY
    }
  }

  function onTouchMove(event) {
    if (!stick.active) return
    for (const touch of event.changedTouches) {
      if (touch.identifier !== stick.id) continue
      stick.x = Math.max(
        -1,
        Math.min(1, (touch.clientX - stick.originX) / STICK_RADIUS)
      )
      stick.y = Math.max(
        -1,
        Math.min(1, (touch.clientY - stick.originY) / STICK_RADIUS)
      )
    }
  }

  function onTouchEnd(event) {
    for (const touch of event.changedTouches) {
      if (touch.identifier !== stick.id) continue
      stick.active = false
      stick.id = null
      stick.x = 0
      stick.y = 0
    }
  }

  if (touchStick) {
    element.addEventListener("touchstart", onTouchStart, { passive: true })
    element.addEventListener("touchmove", onTouchMove, { passive: true })
    element.addEventListener("touchend", onTouchEnd)
    element.addEventListener("touchcancel", onTouchEnd)
  }

  const PAD_BUTTONS = {
    0: "jump",
    1: "crouch",
    2: "fire",
    3: "restart",
    9: "pause",
    12: "up",
    13: "down",
    14: "left",
    15: "right",
  }
  const padHeld = new Set()

  function pollGamepad() {
    const pads = navigator.getGamepads?.() ?? []
    const pad = pads.find((p) => p && p.connected)
    input.gamepadIndex = pad ? pad.index : null
    if (!pad) return { x: 0, y: 0 }

    for (const [index, action] of Object.entries(PAD_BUTTONS)) {
      const code = `Pad${index}`
      const pressed = pad.buttons[index]?.pressed
      if (pressed && !padHeld.has(code)) {
        padHeld.add(code)
        held.add(code)
        justPressed.add(code)
        for (const bound of codesFor(action)) justPressed.add(bound)
        held.add(codesFor(action)[0])
      } else if (!pressed && padHeld.has(code)) {
        padHeld.delete(code)
        held.delete(code)
        held.delete(codesFor(action)[0])
        justReleased.add(code)
      }
    }

    input.look.x += deadzone(pad.axes[2] ?? 0) * 12
    input.look.y += deadzone(pad.axes[3] ?? 0) * 12

    return { x: deadzone(pad.axes[0] ?? 0), y: deadzone(pad.axes[1] ?? 0) }
  }

  function beginFrame() {
    const pad = pollGamepad()
    const keyX = input.axis("left", "right")
    const keyY = input.axis("up", "down")

    input.move.set(pad.x || stick.x || keyX, pad.y || stick.y || keyY)
    if (input.move.lengthSq() > 1) input.move.normalize()
  }

  input.endFrame = () => {
    justPressed.clear()
    justReleased.clear()
    input.look.set(0, 0)
    input.wheel = 0
  }

  input.dispose = () => {
    target.removeEventListener("keydown", onKeyDown)
    target.removeEventListener("keyup", onKeyUp)
    window.removeEventListener("blur", onBlur)
    element.removeEventListener("pointerdown", onPointerDown)
    element.removeEventListener("pointerup", onPointerUp)
    element.removeEventListener("pointermove", onPointerMove)
    element.removeEventListener("pointercancel", onPointerUp)
    element.removeEventListener("wheel", onWheel)
    element.removeEventListener("contextmenu", onContextMenu)
    element.removeEventListener("touchstart", onTouchStart)
    element.removeEventListener("touchmove", onTouchMove)
    element.removeEventListener("touchend", onTouchEnd)
    element.removeEventListener("touchcancel", onTouchEnd)
    document.removeEventListener("pointerlockchange", onLockChange)
    unhook?.()
  }

  let unhook = null
  if (engine) {
    const offEarly = engine.onUpdate(beginFrame)
    const offLate = engine.onLateUpdate(input.endFrame)
    unhook = () => {
      offEarly()
      offLate()
    }
  } else {
    input.beginFrame = beginFrame
  }

  return input
}
