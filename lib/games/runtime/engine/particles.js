import * as THREE from "three"

import { sparkTexture, palette } from "./materials.js"
import { randRange, randSpread, TAU } from "./math.js"

export function createParticles(engine, options = {}) {
  const {
    max = 600,
    size = 0.18,
    color = palette.amber,
    texture = sparkTexture({ color: "#ffffff" }),
    gravity = -9,
    blending = THREE.AdditiveBlending,
    parent = engine.scene,
  } = options

  const positions = new Float32Array(max * 3)
  const colors = new Float32Array(max * 3)
  const sizes = new Float32Array(max)
  const alphas = new Float32Array(max)
  const velocities = new Float32Array(max * 3)
  const life = new Float32Array(max)
  const maxLife = new Float32Array(max)
  const drag = new Float32Array(max)
  const gravityScale = new Float32Array(max)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3))
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute("alpha", new THREE.BufferAttribute(alphas, 1))

  const material = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: texture },
      scale: { value: 1 },
    },
    vertexShader: `
      attribute float size;
      attribute float alpha;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float scale;

      void main() {
        vColor = color;
        vAlpha = alpha;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        // Divided by view depth, so a particle shrinks with distance the way
        // geometry does. Without it a distant spark is as big as a near one.
        gl_PointSize = size * scale * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vec4 texel = texture2D(map, gl_PointCoord);
        gl_FragColor = vec4(vColor, texel.a * vAlpha);
        if (gl_FragColor.a < 0.01) discard;
      }
    `,
    transparent: true,
    depthWrite: false,
    blending,
    vertexColors: true,
  })

  const points = new THREE.Points(geometry, material)
  points.frustumCulled = false
  parent.add(points)

  let cursor = 0
  const baseColor = new THREE.Color(color)
  const scratch = new THREE.Color()

  function emit(position, config = {}) {
    const {
      color: tint = baseColor,
      speed = 4,
      spread = 1,
      lifetime = 0.8,
      size: particleSize = size,
      direction = null,
      drag: particleDrag = 1.2,
      gravityScale: gScale = 1,
    } = config

    const index = cursor
    cursor = (cursor + 1) % max

    positions[index * 3] = position.x
    positions[index * 3 + 1] = position.y
    positions[index * 3 + 2] = position.z

    if (direction) {
      velocities[index * 3] = direction.x * speed + randSpread(spread)
      velocities[index * 3 + 1] = direction.y * speed + randSpread(spread)
      velocities[index * 3 + 2] = direction.z * speed + randSpread(spread)
    } else {
      const theta = Math.random() * TAU
      const phi = Math.acos(randSpread(1))
      const magnitude = speed * randRange(0.4, 1)
      velocities[index * 3] = Math.sin(phi) * Math.cos(theta) * magnitude
      velocities[index * 3 + 1] = Math.cos(phi) * magnitude
      velocities[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * magnitude
    }

    scratch.set(tint)
    colors[index * 3] = scratch.r
    colors[index * 3 + 1] = scratch.g
    colors[index * 3 + 2] = scratch.b

    const duration = lifetime * randRange(0.7, 1.3)
    life[index] = duration
    maxLife[index] = duration
    drag[index] = particleDrag
    gravityScale[index] = gScale
    sizes[index] = particleSize
    alphas[index] = 1
    geometry.attributes.size.needsUpdate = true
    return index
  }

  const origin = new THREE.Vector3()

  const fx = {
    points,
    material,

    burst(position, config = {}) {
      const { count = 20 } = config
      origin.copy(
        position.isVector3 ? position : new THREE.Vector3(...position)
      )
      for (let i = 0; i < count; i++) emit(origin, config)
      return fx
    },

    stream(position, dt, config = {}) {
      const { rate = 30 } = config
      fx._debt = (fx._debt ?? 0) + rate * dt
      const count = Math.floor(fx._debt)
      fx._debt -= count
      if (count > 0) fx.burst(position, { ...config, count })
      return fx
    },

    spray(position, direction, config = {}) {
      return fx.burst(position, {
        direction: direction.clone().normalize(),
        spread: 0.6,
        ...config,
      })
    },

    smoke(position, config = {}) {
      return fx.burst(position, {
        color: "#9ca3af",
        speed: 1.2,
        lifetime: 1.6,
        size: 0.5,
        gravityScale: -0.15,
        drag: 2.5,
        count: 10,
        ...config,
      })
    },

    clear() {
      life.fill(0)
    },

    dispose() {
      geometry.dispose()
      material.dispose()
      texture.dispose()
      parent.remove(points)
    },
  }

  engine.onUpdate((dt) => {
    let alive = false
    for (let i = 0; i < max; i++) {
      if (life[i] <= 0) {
        if (alphas[i] !== 0) {
          alphas[i] = 0
          geometry.attributes.alpha.needsUpdate = true
        }
        continue
      }
      alive = true
      life[i] -= dt

      const i3 = i * 3
      velocities[i3 + 1] += gravity * gravityScale[i] * dt
      const decay = Math.exp(-drag[i] * dt)
      velocities[i3] *= decay
      velocities[i3 + 1] *= decay
      velocities[i3 + 2] *= decay

      positions[i3] += velocities[i3] * dt
      positions[i3 + 1] += velocities[i3 + 1] * dt
      positions[i3 + 2] += velocities[i3 + 2] * dt

      const remaining = Math.max(0, life[i] / maxLife[i])
      alphas[i] = Math.min(1, remaining * 2)
    }

    if (alive) {
      geometry.attributes.position.needsUpdate = true
      geometry.attributes.color.needsUpdate = true
      geometry.attributes.alpha.needsUpdate = true
    }
  })

  return fx
}

export function shockwave(engine, position, options = {}) {
  const {
    color = palette.ember,
    from = 0.4,
    to = 6,
    duration = 0.5,
    thickness = 0.25,
    vertical = false,
  } = options

  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(1 - thickness, 1, 48),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  )
  if (!vertical) mesh.rotation.x = -Math.PI / 2
  mesh.position.copy(position)
  mesh.position.y += 0.05
  engine.scene.add(mesh)

  let elapsed = 0
  const stop = engine.onUpdate((dt) => {
    elapsed += dt
    const t = Math.min(1, elapsed / duration)
    const eased = 1 - (1 - t) ** 3
    mesh.scale.setScalar(from + (to - from) * eased)
    mesh.material.opacity = 1 - t
    if (t >= 1) {
      stop()
      mesh.geometry.dispose()
      mesh.material.dispose()
      engine.scene.remove(mesh)
    }
  })

  return mesh
}

export function createTrail(engine, target, options = {}) {
  const {
    length = 24,
    color = palette.flame,
    width = 2,
    parent = engine.scene,
  } = options

  const positions = new Float32Array(length * 3)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))

  const line = new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.8,
      linewidth: width,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  )
  line.frustumCulled = false
  parent.add(line)

  const world = new THREE.Vector3()
  target.getWorldPosition(world)
  for (let i = 0; i < length; i++) {
    positions[i * 3] = world.x
    positions[i * 3 + 1] = world.y
    positions[i * 3 + 2] = world.z
  }

  const stop = engine.onLateUpdate(() => {
    target.getWorldPosition(world)
    positions.copyWithin(3, 0, (length - 1) * 3)
    positions[0] = world.x
    positions[1] = world.y
    positions[2] = world.z
    geometry.attributes.position.needsUpdate = true
  })

  return {
    line,
    dispose() {
      stop()
      geometry.dispose()
      line.material.dispose()
      parent.remove(line)
    },
  }
}

export function createAmbience(engine, options = {}) {
  const {
    count = 400,
    radius = 60,
    color = "#ffffff",
    size = 0.12,
    drift = 0.4,
    follow = null,
  } = options

  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = randSpread(radius)
    positions[i * 3 + 1] = randRange(0, radius * 0.6)
    positions[i * 3 + 2] = randSpread(radius)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  const points = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      color: new THREE.Color(color),
      size,
      map: sparkTexture({ color: "#ffffff" }),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
  )
  points.frustumCulled = false
  engine.scene.add(points)

  engine.onUpdate((dt) => {
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] -= drift * dt
      if (positions[i * 3 + 1] < 0) positions[i * 3 + 1] = radius * 0.6
    }
    geometry.attributes.position.needsUpdate = true
    if (follow) points.position.set(follow.position.x, 0, follow.position.z)
  })

  return points
}
