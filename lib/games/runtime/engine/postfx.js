import * as THREE from "three"
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js"
import { RenderPass } from "three/addons/postprocessing/RenderPass.js"
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js"
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js"
import { OutputPass } from "three/addons/postprocessing/OutputPass.js"
import { VignetteShader } from "three/addons/shaders/VignetteShader.js"
import { FXAAShader } from "three/addons/shaders/FXAAShader.js"

export function createPostFX(engine, options = {}) {
  const {
    bloom = true,
    vignette = false,
    fxaa = false,
    quality = "auto",
  } = options

  const mobile = matchMedia?.("(pointer: coarse)").matches ?? false
  if (quality === "off" || (quality === "auto" && mobile)) {
    return { enabled: false, composer: null, passes: {}, dispose() {} }
  }

  const { renderer, scene, camera, size } = engine
  const composer = new EffectComposer(renderer)
  composer.setPixelRatio(renderer.getPixelRatio())
  composer.setSize(size.width, size.height)

  const passes = {}

  composer.addPass(new RenderPass(scene, camera))

  if (bloom) {
    const config = bloom === true ? {} : bloom
    const { strength = 0.55, radius = 0.5, threshold = 0.85 } = config
    passes.bloom = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      strength,
      radius,
      threshold
    )
    composer.addPass(passes.bloom)
  }

  if (vignette) {
    const config = vignette === true ? {} : vignette
    passes.vignette = new ShaderPass(VignetteShader)
    passes.vignette.uniforms.offset.value = config.offset ?? 1.1
    passes.vignette.uniforms.darkness.value = config.darkness ?? 1.1
    composer.addPass(passes.vignette)
  }

  composer.addPass(new OutputPass())

  if (fxaa) {
    passes.fxaa = new ShaderPass(FXAAShader)
    composer.addPass(passes.fxaa)
  }

  const target = {
    render: () => composer.render(),
    setSize(width, height) {
      composer.setSize(width, height)
      passes.bloom?.resolution.set(width, height)
      const ratio = renderer.getPixelRatio()
      passes.fxaa?.material.uniforms.resolution.value.set(
        1 / (width * ratio),
        1 / (height * ratio)
      )
    },
  }
  target.setSize(size.width, size.height)
  engine.setRenderTarget(target)

  return {
    enabled: true,
    composer,
    passes,
    setEnabled(value) {
      engine.setRenderTarget(value ? target : null)
    },
    dispose() {
      engine.setRenderTarget(null)
      composer.dispose()
    },
  }
}
