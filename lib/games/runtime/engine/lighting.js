import * as THREE from "three"

import { brand, palette } from "./materials.js"

function addSun(scene, options = {}) {
  const {
    color = "#fff6e5",
    intensity = 2.6,
    position = [8, 14, 6],
    target = [0, 0, 0],
    shadows = true,
    area = 24,
    mapSize = 2048,
  } = options

  const sun = new THREE.DirectionalLight(new THREE.Color(color), intensity)
  sun.position.set(...position)
  sun.target.position.set(...target)
  scene.add(sun)
  scene.add(sun.target)

  if (shadows) {
    sun.castShadow = true
    sun.shadow.mapSize.set(mapSize, mapSize)
    const camera = sun.shadow.camera
    camera.left = -area
    camera.right = area
    camera.top = area
    camera.bottom = -area
    camera.near = 0.5
    camera.far = new THREE.Vector3(...position).length() + area * 2
    camera.updateProjectionMatrix()
    sun.shadow.bias = -0.0004
    sun.shadow.normalBias = 0.02
  }

  return sun
}

export function daylight(scene, options = {}) {
  const sun = addSun(scene, { color: "#fff4e0", intensity: 2.8, ...options })
  const sky = new THREE.HemisphereLight(
    new THREE.Color(palette.sky),
    new THREE.Color("#5b4636"),
    1.1
  )
  scene.add(sky)
  return { sun, sky }
}

export function sunset(scene, options = {}) {
  const sun = addSun(scene, {
    color: brand.amber,
    intensity: 3.2,
    position: [14, 6, 4],
    ...options,
  })
  const sky = new THREE.HemisphereLight(
    new THREE.Color("#7c3aed"),
    new THREE.Color("#431407"),
    0.8
  )
  const rim = new THREE.DirectionalLight(new THREE.Color("#60a5fa"), 0.7)
  rim.position.set(-8, 4, -8)
  scene.add(sky, rim)
  return { sun, sky, rim }
}

export function night(scene, options = {}) {
  const moon = addSun(scene, {
    color: "#a5b4fc",
    intensity: 0.9,
    position: [-6, 12, -4],
    ...options,
  })
  const sky = new THREE.HemisphereLight(
    new THREE.Color("#1e1b4b"),
    new THREE.Color("#020617"),
    0.5
  )
  scene.add(sky)
  return { moon, sky }
}

export function studio(scene, options = {}) {
  const { intensity = 1 } = options
  const key = new THREE.DirectionalLight(0xffffff, 3 * intensity)
  key.position.set(4, 6, 6)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.bias = -0.0004
  key.shadow.normalBias = 0.02

  const fill = new THREE.DirectionalLight(0xdfe8ff, 1 * intensity)
  fill.position.set(-6, 2, 4)

  const rim = new THREE.DirectionalLight(0xffffff, 1.6 * intensity)
  rim.position.set(0, 4, -8)

  const ambient = new THREE.AmbientLight(0xffffff, 0.35 * intensity)

  scene.add(key, fill, rim, ambient)
  return { key, fill, rim, ambient }
}

export function moody(scene, options = {}) {
  const { color = brand.ember, intensity = 3 } = options
  const key = new THREE.SpotLight(
    new THREE.Color(color),
    intensity * 30,
    60,
    Math.PI / 5,
    0.6,
    1.6
  )
  key.position.set(4, 12, 4)
  key.castShadow = true
  key.shadow.mapSize.set(1024, 1024)
  key.shadow.bias = -0.0005
  key.shadow.normalBias = 0.02
  scene.add(key, key.target)

  const ambient = new THREE.AmbientLight(new THREE.Color("#1e293b"), 1.2)
  scene.add(ambient)
  return { key, ambient }
}

export function attachLight(object, options = {}) {
  const {
    color = brand.flame,
    intensity = 8,
    distance = 12,
    offset = [0, 1, 0],
    shadows = false,
  } = options
  const light = new THREE.PointLight(
    new THREE.Color(color),
    intensity,
    distance,
    2
  )
  light.position.set(...offset)
  light.castShadow = shadows
  object.add(light)
  return light
}

export function blobShadow(scene, target, options = {}) {
  const { radius = 0.6, opacity = 0.35, y = 0.01, fadeHeight = 6 } = options
  const canvas = document.createElement("canvas")
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext("2d")
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, "rgba(0,0,0,0.9)")
  gradient.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      opacity,
      depthWrite: false,
    })
  )
  mesh.rotation.x = -Math.PI / 2
  mesh.renderOrder = -1
  scene.add(mesh)

  const world = new THREE.Vector3()

  return {
    mesh,
    update(groundY = 0) {
      target.getWorldPosition(world)
      mesh.position.set(world.x, groundY + y, world.z)
      const fade = Math.max(0, 1 - Math.max(0, world.y - groundY) / fadeHeight)
      mesh.material.opacity = opacity * fade
      mesh.scale.setScalar(0.65 + fade * 0.35)
    },
    dispose() {
      mesh.geometry.dispose()
      mesh.material.map.dispose()
      mesh.material.dispose()
      scene.remove(mesh)
    },
  }
}
