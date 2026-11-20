import * as THREE from "three"

export function showStats(engine, options = {}) {
  const { at = "top-right" } = options
  const element = document.createElement("div")
  element.style.cssText = `
    position: absolute; ${at.includes("top") ? "top" : "bottom"}: 8px;
    ${at.includes("right") ? "right" : "left"}: 8px;
    z-index: 50; pointer-events: none;
    font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
    color: #a1a1a1; background: rgba(10,10,10,0.6);
    padding: 6px 9px; border-radius: 8px; white-space: pre;
  `
  engine.container.appendChild(element)

  let accumulated = 0
  engine.onLateUpdate((dt) => {
    accumulated += dt
    if (accumulated < 0.25) return
    accumulated = 0
    const info = engine.renderer.info
    element.textContent = [
      `${engine.fps.toFixed(0)} fps`,
      `${info.render.calls} draws`,
      `${(info.render.triangles / 1000).toFixed(1)}k tris`,
      `${info.memory.geometries} geo  ${info.memory.textures} tex`,
    ].join("\n")
  })

  return { element, remove: () => element.remove() }
}

export function showHelpers(engine, options = {}) {
  const { grid = 40, axes = 5, light = null } = options
  const added = []

  if (grid) {
    const helper = new THREE.GridHelper(grid, grid, 0x444444, 0x222222)
    engine.scene.add(helper)
    added.push(helper)
  }
  if (axes) {
    const helper = new THREE.AxesHelper(axes)
    engine.scene.add(helper)
    added.push(helper)
  }
  if (light?.shadow) {
    const helper = new THREE.CameraHelper(light.shadow.camera)
    engine.scene.add(helper)
    added.push(helper)
  }

  return {
    helpers: added,
    remove() {
      for (const helper of added) {
        helper.dispose?.()
        engine.scene.remove(helper)
      }
    },
  }
}

export function showColliders(engine, physics, options = {}) {
  const { color = "#22c55e" } = options
  const group = new THREE.Group()
  const material = new THREE.MeshBasicMaterial({ color, wireframe: true })
  engine.scene.add(group)

  for (const collider of physics.statics) {
    if (collider.type !== "box") continue
    const size = collider.box.getSize(new THREE.Vector3())
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size.x, size.y, size.z),
      material
    )
    mesh.position.copy(collider.box.getCenter(new THREE.Vector3()))
    group.add(mesh)
  }

  const bodyMeshes = physics.bodies.map((body) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(body.radius, 12, 8),
      new THREE.MeshBasicMaterial({ color: "#f97316", wireframe: true })
    )
    group.add(mesh)
    return { body, mesh }
  })

  engine.onLateUpdate(() => {
    for (const { body, mesh } of bodyMeshes) mesh.position.copy(body.position)
  })

  return { group, remove: () => engine.scene.remove(group) }
}

const lastLogged = new Map()
export function log(label, value, everySeconds = 0.5) {
  const now = performance.now() / 1000
  if (now - (lastLogged.get(label) ?? -Infinity) < everySeconds) return
  lastLogged.set(label, now)
  console.log(`${label}:`, value)
}
