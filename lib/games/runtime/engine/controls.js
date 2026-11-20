import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"

import { clamp, damp, dampAngle, dampVec } from "./math.js"

export function orbitCamera(engine, options = {}) {
  const {
    target = [0, 0, 0],
    minDistance = 2,
    maxDistance = 80,
    autoRotate = false,
  } = options
  const controls = new OrbitControls(engine.camera, engine.canvas)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.target.set(...target)
  controls.minDistance = minDistance
  controls.maxDistance = maxDistance
  controls.maxPolarAngle = Math.PI * 0.495
  controls.autoRotate = autoRotate
  controls.autoRotateSpeed = 0.6
  engine.onUpdate(() => controls.update())
  return controls
}

export function followCamera(engine, target, options = {}) {
  const {
    distance = 8,
    height = 4,
    stiffness = 6,
    lookHeight = 1,
    lookAhead = 0,
    behind = true,
  } = options

  const camera = engine.camera
  const desired = new THREE.Vector3()
  const lookAt = new THREE.Vector3()
  const smoothLook = new THREE.Vector3()
  const offset = new THREE.Vector3()
  const forward = new THREE.Vector3()
  const shake = { amount: 0, decay: 4 }

  const rig = {
    target,
    distance,
    height,
    stiffness,
    shake(amount = 0.4, decay = 4) {
      shake.amount = Math.max(shake.amount, amount)
      shake.decay = decay
    },
    setTarget(next) {
      rig.target = next
    },
  }

  const update = (dt) => {
    if (!rig.target) return
    const position = rig.target.position

    if (behind) {
      forward.set(0, 0, 1).applyQuaternion(rig.target.quaternion)
      offset.copy(forward).multiplyScalar(rig.distance)
    } else {
      offset.set(0, 0, rig.distance)
    }
    desired.copy(position).add(offset)
    desired.y = position.y + rig.height

    dampVec(camera.position, desired, rig.stiffness, dt)

    lookAt.copy(position)
    lookAt.y += lookHeight
    if (lookAhead && rig.target.userData?.velocity) {
      lookAt.addScaledVector(rig.target.userData.velocity, lookAhead)
    }
    dampVec(smoothLook, lookAt, rig.stiffness * 1.5, dt)
    camera.lookAt(smoothLook)

    if (shake.amount > 0.001) {
      camera.position.x += (Math.random() - 0.5) * shake.amount
      camera.position.y += (Math.random() - 0.5) * shake.amount
      camera.position.z += (Math.random() - 0.5) * shake.amount
      shake.amount *= Math.exp(-shake.decay * dt)
    } else {
      shake.amount = 0
    }
  }

  rig.stop = engine.onLateUpdate(update)
  smoothLook.copy(target?.position ?? new THREE.Vector3())
  return rig
}

export function topDownCamera(engine, target, options = {}) {
  const { height = 18, tilt = 0.35, stiffness = 6, bounds = null } = options
  const camera = engine.camera
  const desired = new THREE.Vector3()
  const rig = { target, height, stiffness }

  rig.stop = engine.onLateUpdate((dt) => {
    if (!rig.target) return
    desired.set(
      rig.target.position.x,
      rig.target.position.y + rig.height,
      rig.target.position.z + rig.height * tilt
    )
    if (bounds) {
      desired.x = clamp(desired.x, bounds.minX, bounds.maxX)
      desired.z = clamp(desired.z, bounds.minZ, bounds.maxZ)
    }
    dampVec(camera.position, desired, rig.stiffness, dt)
    camera.lookAt(
      rig.target.position.x,
      rig.target.position.y,
      rig.target.position.z
    )
  })

  return rig
}

export function sideCamera(engine, target, options = {}) {
  const {
    distance = 14,
    stiffness = 5,
    offsetY = 1.5,
    deadzone = 1.2,
  } = options
  const camera = engine.camera
  const focus = new THREE.Vector3()
  const rig = { target, distance, stiffness }

  camera.position.z = distance

  rig.stop = engine.onLateUpdate((dt) => {
    if (!rig.target) return
    const dx = rig.target.position.x - focus.x
    const dy = rig.target.position.y + offsetY - focus.y
    if (Math.abs(dx) > deadzone) focus.x += dx - Math.sign(dx) * deadzone
    if (Math.abs(dy) > deadzone) focus.y += dy - Math.sign(dy) * deadzone

    camera.position.x = damp(camera.position.x, focus.x, rig.stiffness, dt)
    camera.position.y = damp(camera.position.y, focus.y, rig.stiffness, dt)
    camera.position.z = rig.distance
    camera.lookAt(camera.position.x, camera.position.y, 0)
  })

  return rig
}

export function firstPerson(engine, input, options = {}) {
  const {
    body = null,
    speed = 7,
    sprintSpeed = 11,
    jump = 9,
    sensitivity = 0.0022,
    eyeHeight = 1.7,
    position = [0, eyeHeight, 6],
    lockOnClick = true,
  } = options

  const yaw = new THREE.Object3D()
  yaw.position.set(...position)
  engine.scene.add(yaw)
  yaw.add(engine.camera)
  engine.camera.position.set(0, 0, 0)
  engine.camera.rotation.set(0, 0, 0)

  if (lockOnClick) {
    engine.canvas.addEventListener("pointerdown", () =>
      input.requestPointerLock()
    )
  }

  const forward = new THREE.Vector3()
  const right = new THREE.Vector3()
  const move = new THREE.Vector3()
  let pitch = 0
  let bobPhase = 0

  const controller = {
    object: yaw,
    body,
    speed,
    get grounded() {
      return body ? body.grounded : yaw.position.y <= eyeHeight + 0.001
    },
  }

  controller.stop = engine.onUpdate((dt) => {
    if (input.locked || !lockOnClick) {
      yaw.rotation.y -= input.look.x * sensitivity
      pitch = clamp(
        pitch - input.look.y * sensitivity,
        -Math.PI / 2 + 0.05,
        Math.PI / 2 - 0.05
      )
      engine.camera.rotation.x = pitch
    }

    forward
      .set(0, 0, -1)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw.rotation.y)
    right
      .set(1, 0, 0)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw.rotation.y)

    const rate = input.down("sprint") ? sprintSpeed : controller.speed
    move.set(0, 0, 0)
    move.addScaledVector(forward, -input.move.y)
    move.addScaledVector(right, input.move.x)
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(rate)

    if (body) {
      body.velocity.x = move.x
      body.velocity.z = move.z
      if (input.pressed("jump") && body.grounded) body.velocity.y = jump
      yaw.position.copy(body.position)
      yaw.position.y += eyeHeight - body.radius
    } else {
      yaw.position.addScaledVector(move, dt)
    }

    const travelling = move.length() / Math.max(rate, 0.001)
    bobPhase += dt * 11 * travelling
    engine.camera.position.y = Math.sin(bobPhase) * 0.045 * travelling
  })

  return controller
}

export function thirdPerson(engine, input, object, options = {}) {
  const {
    body = null,
    speed = 6,
    sprintSpeed = 10,
    jump = 10,
    turnRate = 12,
    relativeTo = engine.camera,
  } = options

  const move = new THREE.Vector3()
  const forward = new THREE.Vector3()
  const right = new THREE.Vector3()
  const velocity = new THREE.Vector3()
  object.userData.velocity = velocity

  const controller = {
    object,
    body,
    speed,
    velocity,
    travel: 0,
    get grounded() {
      return body ? body.grounded : object.position.y <= 0.001
    },
  }

  controller.stop = engine.onUpdate((dt) => {
    relativeTo.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()
    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

    const rate = input.down("sprint") ? sprintSpeed : controller.speed
    move.set(0, 0, 0)
    move.addScaledVector(forward, -input.move.y)
    move.addScaledVector(right, input.move.x)
    if (move.lengthSq() > 0) move.normalize().multiplyScalar(rate)

    controller.travel = move.length() / Math.max(rate, 0.001)

    if (body) {
      body.velocity.x = move.x
      body.velocity.z = move.z
      if (input.pressed("jump") && body.grounded) body.velocity.y = jump
      object.position.copy(body.position)
      object.position.y -= body.radius
      velocity.copy(body.velocity)
    } else {
      object.position.addScaledVector(move, dt)
      velocity.copy(move)
    }

    if (move.lengthSq() > 0.001) {
      const heading = Math.atan2(move.x, move.z)
      object.rotation.y = dampAngle(object.rotation.y, heading, turnRate, dt)
    }
  })

  return controller
}

export function platformer(engine, input, object, options = {}) {
  const {
    body = null,
    speed = 8,
    acceleration = 60,
    jump = 14,
    gravity = -40,
    coyoteTime = 0.12,
    jumpBuffer = 0.12,
    shortHopFactor = 0.45,
    plane = "x",
  } = options

  const velocity = body ? body.velocity : new THREE.Vector3()
  object.userData.velocity = velocity
  let sinceGrounded = Infinity
  let sinceJumpPress = Infinity

  const controller = {
    object,
    body,
    velocity,
    speed,
    get grounded() {
      return body ? body.grounded : object.position.y <= 0.001
    },
  }

  controller.stop = engine.onUpdate((dt) => {
    const grounded = controller.grounded
    sinceGrounded = grounded ? 0 : sinceGrounded + dt
    sinceJumpPress = input.pressed("jump") ? 0 : sinceJumpPress + dt

    const wanted = input.move.x * speed
    const axis = plane
    velocity[axis] +=
      (wanted - velocity[axis]) * Math.min(1, acceleration * dt * 0.1)

    if (sinceJumpPress <= jumpBuffer && sinceGrounded <= coyoteTime) {
      velocity.y = jump
      sinceJumpPress = Infinity
      sinceGrounded = Infinity
    }
    if (input.released("jump") && velocity.y > 0) velocity.y *= shortHopFactor

    if (!body) {
      velocity.y += gravity * dt
      object.position.addScaledVector(velocity, dt)
      if (object.position.y < 0) {
        object.position.y = 0
        velocity.y = 0
      }
    } else {
      object.position.copy(body.position)
    }

    if (Math.abs(velocity[axis]) > 0.1) {
      object.rotation.y = velocity[axis] > 0 ? Math.PI / 2 : -Math.PI / 2
    }
  })

  return controller
}

export function pointerOnGround(engine, input, height = 0) {
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -height)
  const raycaster = new THREE.Raycaster()
  const point = new THREE.Vector3()

  return () => {
    raycaster.setFromCamera(input.pointer, engine.camera)
    return raycaster.ray.intersectPlane(plane, point) ? point : null
  }
}

export function pointerPicker(engine, input, objects) {
  const raycaster = new THREE.Raycaster()
  return () => {
    raycaster.setFromCamera(input.pointer, engine.camera)
    return raycaster.intersectObjects(objects, true)[0] ?? null
  }
}
