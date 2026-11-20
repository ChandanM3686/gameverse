import * as THREE from "three"

export const brand = {
  ember: "#ea580c",
  flame: "#f97316",
  amber: "#fb923c",
  ink: "#0a0a0a",
  ash: "#171717",
  slate: "#262626",
  smoke: "#525252",
  mist: "#a1a1a1",
  snow: "#ededed",
}

export const palette = {
  ...brand,
  red: "#ef4444",
  orange: "#f97316",
  yellow: "#facc15",
  lime: "#84cc16",
  green: "#22c55e",
  teal: "#14b8a6",
  cyan: "#06b6d4",
  blue: "#3b82f6",
  indigo: "#6366f1",
  violet: "#a855f7",
  pink: "#ec4899",
  brown: "#92400e",
  sand: "#e7d3a1",
  sky: "#7dd3fc",
  night: "#0f172a",
  white: "#ffffff",
  black: "#000000",
}

export function mix(a, b, t) {
  return new THREE.Color(a).lerp(new THREE.Color(b), t)
}

export function shade(color, amount) {
  const c = new THREE.Color(color)
  const hsl = c.getHSL({ h: 0, s: 0, l: 0 })
  c.setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l + amount, 0, 1))
  return c
}

export function standard(options = {}) {
  const { color = palette.mist, ...rest } = options
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.75,
    metalness: 0,
    ...rest,
  })
}

export function matte(color, options = {}) {
  return standard({ color, roughness: 0.95, metalness: 0, ...options })
}

export function metal(color, options = {}) {
  return standard({ color, roughness: 0.28, metalness: 1, ...options })
}

export function glow(color, options = {}) {
  const { intensity = 1.6, ...rest } = options
  return standard({
    color,
    emissive: new THREE.Color(color),
    emissiveIntensity: intensity,
    roughness: 0.4,
    ...rest,
  })
}

export function flat(color, options = {}) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    ...options,
  })
}

export function toon(color, steps = 4, options = {}) {
  const data = new Uint8Array(steps)
  for (let i = 0; i < steps; i++) data[i] = Math.round((i / (steps - 1)) * 255)
  const gradient = new THREE.DataTexture(data, steps, 1, THREE.RedFormat)
  gradient.minFilter = THREE.NearestFilter
  gradient.magFilter = THREE.NearestFilter
  gradient.needsUpdate = true
  return new THREE.MeshToonMaterial({
    color: new THREE.Color(color),
    gradientMap: gradient,
    ...options,
  })
}

export function glass(color = "#ffffff", options = {}) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    roughness: 0.05,
    metalness: 0,
    transmission: 0.95,
    thickness: 0.5,
    ior: 1.4,
    ...options,
  })
}

export function wireframe(color = palette.ember, options = {}) {
  return new THREE.MeshBasicMaterial({
    color: new THREE.Color(color),
    wireframe: true,
    ...options,
  })
}

export function outline(mesh, options = {}) {
  const { color = "#000000", thickness = 0.04 } = options
  const shell = new THREE.Mesh(
    mesh.geometry,
    new THREE.MeshBasicMaterial({ color, side: THREE.BackSide })
  )
  shell.scale.multiplyScalar(1 + thickness)
  shell.castShadow = false
  shell.receiveShadow = false
  mesh.add(shell)
  return shell
}

function canvasTexture(size, draw) {
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  draw(canvas.getContext("2d"), size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.anisotropy = 8
  return texture
}

export function checkerTexture(options = {}) {
  const {
    light = "#2a2a2a",
    dark = "#1c1c1c",
    squares = 8,
    size = 512,
  } = options
  return canvasTexture(size, (ctx, s) => {
    const cell = s / squares
    for (let y = 0; y < squares; y++) {
      for (let x = 0; x < squares; x++) {
        ctx.fillStyle = (x + y) % 2 ? dark : light
        ctx.fillRect(x * cell, y * cell, cell, cell)
      }
    }
  })
}

export function gridTexture(options = {}) {
  const {
    background = "#0a0a0a",
    line = brand.ember,
    divisions = 8,
    lineWidth = 2,
    size = 512,
  } = options
  return canvasTexture(size, (ctx, s) => {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, s, s)
    ctx.strokeStyle = line
    ctx.lineWidth = lineWidth
    const cell = s / divisions
    for (let i = 0; i <= divisions; i++) {
      ctx.beginPath()
      ctx.moveTo(i * cell, 0)
      ctx.lineTo(i * cell, s)
      ctx.moveTo(0, i * cell)
      ctx.lineTo(s, i * cell)
      ctx.stroke()
    }
  })
}

export function noiseTexture(options = {}) {
  const { size = 256, scale = 32, contrast = 1, tint = "#ffffff" } = options
  return canvasTexture(size, (ctx, s) => {
    const image = ctx.createImageData(s, s)
    const color = new THREE.Color(tint)
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const n = smoothNoise(x / (s / scale), y / (s / scale))
        const v = THREE.MathUtils.clamp((n - 0.5) * contrast + 0.5, 0, 1)
        const i = (y * s + x) * 4
        image.data[i] = v * color.r * 255
        image.data[i + 1] = v * color.g * 255
        image.data[i + 2] = v * color.b * 255
        image.data[i + 3] = 255
      }
    }
    ctx.putImageData(image, 0, 0)
  })
}

const noiseSeeds = new Map()
function hashNoise(x, y) {
  const key = x * 65536 + y
  let value = noiseSeeds.get(key)
  if (value === undefined) {
    value = Math.abs(Math.sin(x * 127.1 + y * 311.7) * 43758.5453) % 1
    noiseSeeds.set(key, value)
  }
  return value
}

function smoothNoise(x, y) {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const a = hashNoise(x0, y0)
  const b = hashNoise(x0 + 1, y0)
  const c = hashNoise(x0, y0 + 1)
  const d = hashNoise(x0 + 1, y0 + 1)
  return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy
}

export function gradientTexture(stops, options = {}) {
  const { size = 256 } = options
  const entries = Array.isArray(stops) ? stops : Object.entries(stops)
  return canvasTexture(size, (ctx, s) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, s)
    entries.forEach(([offset, color], index) => {
      gradient.addColorStop(
        typeof offset === "number" ? offset : index / (entries.length - 1),
        color
      )
    })
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, s, s)
  })
}

export function sparkTexture(options = {}) {
  const { size = 128, color = "#ffffff", softness = 1 } = options
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  const gradient = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2
  )
  const c = new THREE.Color(color)
  const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`
  gradient.addColorStop(0, `rgba(${rgb},1)`)
  gradient.addColorStop(0.4 / softness, `rgba(${rgb},0.55)`)
  gradient.addColorStop(1, `rgba(${rgb},0)`)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

export function textTexture(text, options = {}) {
  const {
    color = "#ffffff",
    background = "transparent",
    font = "700 96px ui-sans-serif, system-ui, sans-serif",
    padding = 32,
  } = options
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  ctx.font = font
  const width = Math.ceil(ctx.measureText(text).width) + padding * 2
  const height = 128 + padding * 2
  canvas.width = width
  canvas.height = height
  const draw = canvas.getContext("2d")
  if (background !== "transparent") {
    draw.fillStyle = background
    draw.fillRect(0, 0, width, height)
  }
  draw.font = font
  draw.fillStyle = color
  draw.textAlign = "center"
  draw.textBaseline = "middle"
  draw.fillText(text, width / 2, height / 2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

export function skyGradient(scene, top = "#1b2a4a", bottom = "#ea580c") {
  const texture = gradientTexture([
    [0, top],
    [1, bottom],
  ])
  scene.background = texture
  return texture
}
