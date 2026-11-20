import { createEngine } from "./engine.js"
import { createInput } from "./input.js"
import { createHud } from "./hud.js"
import { createAudio } from "./sound.js"
import { createTweens } from "./animation.js"

export * as math from "./math.js"
export * as models from "./models.js"
export * as materials from "./materials.js"
export * as lights from "./lighting.js"
export * as effects from "./particles.js"
export * as anim from "./animation.js"
export * as debug from "./debug.js"

export { createEngine, disposeObject } from "./engine.js"
export { createInput } from "./input.js"
export { createHud } from "./hud.js"
export { createAudio } from "./sound.js"
export { createPhysics, hits, inside } from "./physics.js"
export { createPostFX } from "./postfx.js"

export {
  createTweens,
  createMixer,
  createShake,
  Spring,
  SpringVec3,
  flash,
  pop,
  hover,
  ease,
} from "./animation.js"

export {
  createParticles,
  createTrail,
  createAmbience,
  shockwave,
} from "./particles.js"

export {
  createStateMachine,
  createScore,
  createStorage,
  createTimer,
  createTicker,
  createCooldown,
  createDifficulty,
  createEvents,
  formatTime,
} from "./state.js"

export {
  orbitCamera,
  followCamera,
  topDownCamera,
  sideCamera,
  firstPerson,
  thirdPerson,
  platformer,
  pointerOnGround,
  pointerPicker,
} from "./controls.js"

export { palette, brand } from "./materials.js"

export function createGame(options = {}) {
  const { actions, hud: hudOptions = {}, ...engineOptions } = options

  const engine = createEngine(engineOptions)
  const input = createInput({ engine, actions })
  const hud = createHud({ container: engine.container, ...hudOptions })
  const audio = createAudio()
  const tweens = createTweens(engine)

  engine.start()

  return {
    engine,
    input,
    hud,
    audio,
    tweens,
    scene: engine.scene,
    camera: engine.camera,
    renderer: engine.renderer,
    onUpdate: engine.onUpdate,
    onLateUpdate: engine.onLateUpdate,
    onResize: engine.onResize,
    add: engine.add,
    remove: engine.remove,
  }
}
