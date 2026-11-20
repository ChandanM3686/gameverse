import * as THREE from "three"

import { clamp } from "./math.js"

const MAX_DELTA = 1 / 15

export function createEngine(options = {}) {
  const {
    container = document.body,
    background = "#0a0a0a",
    fog = null,
    fov = 60,
    near = 0.1,
    far = 500,
    cameraPosition = [0, 4, 10],
    lookAt = [0, 0, 0],
    antialias = true,
    alpha = false,
    shadows = true,
    maxPixelRatio = 2,
    toneMapping = THREE.ACESFilmicToneMapping,
    exposure = 1,
    pauseWhenHidden = true,
  } = options

  const renderer = new THREE.WebGLRenderer({
    antialias,
    alpha,
    powerPreference: "high-performance",
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = toneMapping
  renderer.toneMappingExposure = exposure

  if (shadows) {
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
  }

  const canvas = renderer.domElement
  canvas.style.display = "block"
  canvas.style.width = "100%"
  canvas.style.height = "100%"
  canvas.style.touchAction = "none"
  container.appendChild(canvas)

  const scene = new THREE.Scene()
  if (background !== null) scene.background = new THREE.Color(background)
  if (fog) {
    scene.fog =
      typeof fog === "number"
        ? new THREE.FogExp2(new THREE.Color(background).getHex(), fog)
        : new THREE.Fog(fog.color ?? background, fog.near ?? 10, fog.far ?? 80)
  }

  const camera = new THREE.PerspectiveCamera(fov, 1, near, far)
  camera.position.set(...cameraPosition)
  camera.lookAt(new THREE.Vector3(...lookAt))
  scene.add(camera)

  const updates = new Set()
  const lateUpdates = new Set()
  const resizes = new Set()

  const clock = new THREE.Clock(false)
  let running = false
  let paused = false
  let elapsed = 0
  let frame = 0
  let fps = 60

  let renderTarget = { render: () => renderer.render(scene, camera) }

  const size = { width: 1, height: 1 }

  function resize() {
    const rect = container.getBoundingClientRect?.()
    const width = Math.max(1, Math.floor(rect?.width || window.innerWidth))
    const height = Math.max(1, Math.floor(rect?.height || window.innerHeight))
    if (width === size.width && height === size.height) return

    size.width = width
    size.height = height

    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height, false)
    renderTarget.setSize?.(width, height)

    for (const fn of resizes) fn(width, height)
  }

  const observer =
    typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null
  if (observer && container !== document.body) observer.observe(container)
  window.addEventListener("resize", resize)
  resize()

  function tick() {
    const raw = clock.getDelta()
    if (paused) {
      renderTarget.render()
      return
    }

    const dt = clamp(raw, 0, MAX_DELTA) * engine.timeScale
    elapsed += dt
    frame++
    if (raw > 0) fps += (1 / raw - fps) * 0.1

    engine.dt = dt
    engine.elapsed = elapsed
    engine.frame = frame
    engine.fps = fps

    for (const fn of updates) fn(dt, elapsed)
    for (const fn of lateUpdates) fn(dt, elapsed)

    renderTarget.render()
  }

  function onVisibility() {
    if (document.hidden) engine.pause()
    else engine.resume()
  }
  if (pauseWhenHidden)
    document.addEventListener("visibilitychange", onVisibility)

  const engine = {
    renderer,
    scene,
    camera,
    canvas,
    container,
    clock,
    size,
    dt: 0,
    elapsed: 0,
    frame: 0,
    fps: 60,
    timeScale: 1,

    get running() {
      return running
    },
    get paused() {
      return paused
    },

    onUpdate(fn) {
      updates.add(fn)
      return () => updates.delete(fn)
    },
    onLateUpdate(fn) {
      lateUpdates.add(fn)
      return () => lateUpdates.delete(fn)
    },
    onResize(fn) {
      resizes.add(fn)
      fn(size.width, size.height)
      return () => resizes.delete(fn)
    },

    add(...objects) {
      scene.add(...objects)
      return objects[0]
    },
    remove(...objects) {
      scene.remove(...objects)
    },

    start() {
      if (running) return engine
      running = true
      paused = false
      clock.start()
      renderer.setAnimationLoop(tick)
      return engine
    },
    stop() {
      running = false
      clock.stop()
      renderer.setAnimationLoop(null)
    },
    pause() {
      paused = true
    },
    resume() {
      clock.getDelta()
      paused = false
    },

    setRenderTarget(target) {
      renderTarget = target ?? { render: () => renderer.render(scene, camera) }
      renderTarget.setSize?.(size.width, size.height)
    },

    dispose() {
      engine.stop()
      window.removeEventListener("resize", resize)
      document.removeEventListener("visibilitychange", onVisibility)
      observer?.disconnect()
      disposeObject(scene)
      renderer.dispose()
      canvas.remove()
    },
  }

  return engine
}

export function disposeObject(root) {
  root.traverse((child) => {
    child.geometry?.dispose()
    const materials = Array.isArray(child.material)
      ? child.material
      : child.material
        ? [child.material]
        : []
    for (const material of materials) {
      for (const value of Object.values(material)) {
        if (value && value.isTexture) value.dispose()
      }
      material.dispose()
    }
  })
  root.parent?.remove(root)
}
