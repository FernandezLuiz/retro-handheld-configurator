import * as THREE from 'three'
import { createTitle } from './title.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createPlaceholder } from './placeholder.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { centerModel, disposeModel } from './model-utils.js'
import { createHandheldController } from './handheld.js'
import { createEnvironment } from './environment.js'

// Read-only diagnostics used by browser regression checks; no state mutations.
const viewers = new WeakMap()
export function inspectViewer(container) { return viewers.get(container)?.() }

export function createViewer(container) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#eeefea')
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
  camera.position.set(4, 2.7, 6)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor('#eeefea')
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.domElement.setAttribute('aria-label', 'Temporary 3D form. Drag to rotate and scroll to zoom.')
  container.appendChild(renderer.domElement)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enablePan = false
  // Keep the camera above the presentation surfaces, including when orbiting
  // behind the product. This also hides open scene boundaries below the floor.
  controls.minPolarAngle = 0.42
  controls.maxPolarAngle = Math.PI / 2 - 0.07
  controls.minDistance = 4
  controls.maxDistance = 12
  controls.saveState()

  const environment = createEnvironment(renderer, scene, container.closest('.viewport'))
  environment.setPreset('Arcade')
  const title = createTitle(scene, () => container.closest('.viewport').classList.add('title-ready'))
  let model = createPlaceholder()
  const productRoot = new THREE.Group()
  productRoot.name = 'handheld_presentation'
  productRoot.add(model)
  scene.add(productRoot)
  let disposed = false
  const handheld = createHandheldController()
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const pointer = new THREE.Vector2()
  const pointerTarget = new THREE.Vector2()
  const pointerListeners = new AbortController()
  const ATTRACT_DELAY = 18000
  let idleTime = 0
  let lastInteraction = performance.now()
  let attracting = false
  const stopAttract = () => {
    lastInteraction = performance.now()
    attracting = false
    controls.autoRotate = false
  }
  const notePointerMove = event => {
    if (Math.abs(event.movementX) + Math.abs(event.movementY) > 2) stopAttract()
  }
  window.addEventListener('pointermove', notePointerMove, { signal: pointerListeners.signal })
  for (const name of ['pointerdown', 'wheel', 'touchstart']) {
    window.addEventListener(name, stopAttract, { signal: pointerListeners.signal, passive: true })
  }
  document.addEventListener('keydown', stopAttract, { signal: pointerListeners.signal })

  renderer.domElement.addEventListener('pointermove', event => {
    const bounds = renderer.domElement.getBoundingClientRect()
    pointerTarget.set(
      THREE.MathUtils.clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1),
      THREE.MathUtils.clamp((event.clientY - bounds.top) / bounds.height * 2 - 1, -1, 1),
    )
  }, { signal: pointerListeners.signal })
  renderer.domElement.addEventListener('pointerleave', () => pointerTarget.set(0, 0), { signal: pointerListeners.signal })

  let framedRadius = null
  let framedWidthRadius = null
  let fitDistance = null
  let frameHandler = null
  let playInspector = null
  let screenTexture = null
  let previousTime = null
  let coveredLastFrame = false
  let playProgress = 0
  let playDestination = 0
  let playDuration = 1.25
  let reducedPlayMotion = false
  let savedView = null
  let screenFocus = null
  let screenDistance = 1
  let buttonMeshes = []

  function updatePlayCamera(dt) {
    if (!savedView) return
    playProgress = THREE.MathUtils.clamp(playProgress + (playDestination ? 1 : -1) * dt / playDuration, 0, 1)
    const t = playProgress * playProgress * (3 - 2 * playProgress)
    const target = savedView.target.clone().lerp(screenFocus, t)
    const offset = savedView.position.clone().sub(savedView.target)
    const direction = offset.clone().normalize()
    // Rotate outside the shell before dollying inward, even from a rear view.
    const rotation = new THREE.Quaternion().setFromUnitVectors(direction, new THREE.Vector3(0, 0, 1))
    const travel = new THREE.Quaternion().slerp(rotation, Math.min(1, t / 0.65))
    direction.applyQuaternion(travel)
    const distance = THREE.MathUtils.lerp(offset.length(), screenDistance, t * t)
    if (!reducedPlayMotion) {
      camera.position.copy(target).addScaledVector(direction, distance)
      camera.lookAt(target)
    } else {
      camera.position.copy(savedView.position)
      camera.quaternion.copy(savedView.quaternion)
    }
    handheld.setScreenGlow(0.3 + t * 0.35)
    if (!playDestination && playProgress === 0) {
      camera.position.copy(savedView.position)
      camera.quaternion.copy(savedView.quaternion)
      controls.target.copy(savedView.target)
      controls.enabled = savedView.enabled
      savedView = null
    }
  }

  function setButtonFeedback(keys) {
    for (const { mesh, position, quaternion, center } of buttonMeshes) {
      mesh.position.copy(position)
      mesh.quaternion.copy(quaternion)
      const pressed = mesh.name === 'dpad'
        ? ['left', 'right', 'up', 'down'].some(key => keys.has(key))
        : keys.has(mesh.name === 'button_a' ? 'action' : 'brake')
      // GLB transforms are applied; pivot around the control itself, without deforming it.
      if (pressed && mesh.name === 'dpad') {
        const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(
          (Number(keys.has('down')) - Number(keys.has('up'))) * 0.045,
          (Number(keys.has('right')) - Number(keys.has('left'))) * 0.045, 0))
        mesh.quaternion.multiply(tilt)
        mesh.position.add(center).sub(center.clone().applyQuaternion(tilt))
        mesh.position.z -= 0.0003
      } else if (pressed) mesh.position.z -= 0.00065
    }
  }
  const defaultDirection = new THREE.Vector3(0.14, 0.14, 1).normalize()

  function frameModel(preserveView = false) {
    if (!framedRadius) return
    const vertical = THREE.MathUtils.degToRad(camera.fov / 2)
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect)
    const distance = Math.max(framedRadius / Math.sin(vertical), framedWidthRadius / Math.sin(horizontal)) * 1.36
    const offset = camera.position.clone().sub(controls.target)
    const zoomRatio = preserveView && fitDistance ? offset.length() / fitDistance : 1
    const direction = preserveView ? offset.normalize() : defaultDirection
    // On portrait viewports, reserve the upper grid row for the title and
    // supporting information while keeping the product centered below it.
    const layoutOffset = camera.aspect < 0.8 ? framedRadius * 0.16 : 0
    controls.target.set(0, layoutOffset, 0)
    controls.minDistance = framedRadius * 1.3
    // Keep the fitted product view as the furthest view, with a little extra
    // presence so wheel zoom cannot shrink it behind the arcade room.
    controls.maxDistance = distance * 0.95
    camera.position.copy(direction).multiplyScalar(THREE.MathUtils.clamp(distance * zoomRatio, controls.minDistance, controls.maxDistance)).add(controls.target)
    camera.near = framedRadius / 100
    camera.far = distance * 20
    camera.updateProjectionMatrix()
    // Avoid applying residual drag velocity when framing or resetting.
    const damping = controls.enableDamping
    controls.enableDamping = false
    controls.update()
    controls.enableDamping = damping
    fitDistance = distance
    if (!preserveView) controls.saveState()
  }

  // Keep the placeholder until a complete, usable GLB is ready.
  new GLTFLoader().load('/models/retro-handheld.glb', gltf => {
    if (disposed) {
      disposeModel(gltf.scene)
      return
    }
    try {
      const loadedModel = centerModel(gltf.scene)
      handheld.attach(loadedModel)
      productRoot.remove(model)
      disposeModel(model)
      model = loadedModel
      productRoot.add(model)
      framedRadius = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere()).radius
      const modelSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3())
      framedWidthRadius = Math.hypot(modelSize.x, modelSize.z) / 2
      frameModel()
      buttonMeshes = ['dpad', 'button_a', 'button_b'].map(name => {
        const mesh = model.getObjectByName(name)
        if (mesh) mesh.geometry.computeBoundingBox()
        return mesh && { mesh, position: mesh.position.clone(), quaternion: mesh.quaternion.clone(), center: mesh.geometry.boundingBox.getCenter(new THREE.Vector3()) }
      }).filter(Boolean)
      renderer.domElement.setAttribute('aria-label', 'Handheld 3D preview. Drag to rotate and scroll to zoom.')
    } catch (error) {
      disposeModel(gltf.scene)
      console.warn('Could not prepare retro-handheld.glb; keeping the placeholder.', error)
    }
  }, undefined, error => {
    if (!disposed) console.info('Handheld model unavailable; keeping the placeholder.', error)
  })

  const resizeObserver = new ResizeObserver(() => {
    const { width, height } = container.getBoundingClientRect()
    if (!width || !height) return
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    renderer.setSize(width, height)
    if (!savedView) frameModel(true)
  })
  resizeObserver.observe(container)
  renderer.setAnimationLoop(time => {
    const elapsed = previousTime === null ? 0 : Math.max(0, (time - previousTime) / 1000)
    const dt = Math.min(elapsed, 0.1)
    previousTime = time
    if (savedView) updatePlayCamera(elapsed)
    else {
      const shouldAttract = !reducedMotion.matches && !document.hidden && performance.now() - lastInteraction >= ATTRACT_DELAY
      if (shouldAttract !== attracting) {
        attracting = shouldAttract
        controls.autoRotate = attracting
        controls.autoRotateSpeed = 0.24
      }
      controls.update()
      if (!reducedMotion.matches) {
        idleTime += dt
        pointer.lerp(pointerTarget, 1 - Math.exp(-dt * 3.5))
        productRoot.position.y = attracting ? Math.sin(idleTime * 0.7) * 0.018 : 0
        productRoot.rotation.x = -pointer.y * 0.005
        productRoot.rotation.y = pointer.x * 0.008
        productRoot.rotation.z = 0
      } else {
        productRoot.position.set(0, 0, 0)
        productRoot.rotation.set(0, 0, 0)
      }
    }
    title.update(camera, playProgress, idleTime, reducedMotion.matches)
    frameHandler?.(dt)
    // The opaque game view covers the 3D canvas. Keep the one shared clock,
    // but avoid an invisible full-resolution transmission pass every frame.
    // The same live texture is uploaded again as soon as the exit begins.
    const covered = playProgress === 1 && playDestination === 1
    if (!covered) environment.update(dt, reducedMotion.matches)
    if (!covered || !coveredLastFrame) renderer.render(scene, camera)
    coveredLastFrame = covered
  })

  viewers.set(container, () => {
    const product = []
    model.traverse(object => {
      if (!object.isMesh) return
      const material = Array.isArray(object.material) ? object.material[0] : object.material
      product.push({ name: object.name, color: material.color?.getHexString(), visible: object.visible, transmission: material.transmission ?? 0 })
    })
    return {
      title: title.inspect(camera),
      environments: environment.stats(),
      sceneObjects: scene.children.length,
      memory: { ...renderer.info.memory },
      camera: camera.position.toArray(),
      product,
      controlsEnabled: controls.enabled,
      playProgress,
      liveScreen: Boolean(screenTexture?.isCanvasTexture),
      screenFlipY: screenTexture?.flipY,
      buttonFeedback: buttonMeshes.map(({ mesh }) => ({ name: mesh.name, position: mesh.position.toArray(), quaternion: mesh.quaternion.toArray() })),
      target: controls.target.toArray(),
      play: playInspector?.(),
      idlePresentation: { position: productRoot.position.toArray(), rotation: productRoot.rotation.toArray() },
      orbitLimits: { minPolarAngle: controls.minPolarAngle, maxPolarAngle: controls.maxPolarAngle, minDistance: controls.minDistance, maxDistance: controls.maxDistance, currentDistance: camera.position.distanceTo(controls.target) },
      attracting,
    }
  })

  return {
    canPlay() { return Boolean(model.getObjectByName('screen')) && !disposed },
    setFrameHandler(handler, inspector) { frameHandler = handler; playInspector = inspector },
    setScreenTexture(texture) { screenTexture = texture; handheld.setScreenTexture(texture) },
    setButtonFeedback,
    get playProgress() { return playProgress },
    get attracting() { return attracting },
    setPlayMode(playing, reducedMotion = false) {
      if (playing && !savedView) {
        stopAttract()
        const screen = model.getObjectByName('screen')
        if (!screen) return false
        savedView = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), target: controls.target.clone(), enabled: controls.enabled }
        // Flush residual orbit damping without changing the saved view.
        controls.enableDamping = false
        controls.update()
        controls.enableDamping = true
        controls.enabled = false
        const bounds = new THREE.Box3().setFromObject(screen)
        screenFocus = bounds.getCenter(new THREE.Vector3())
        const size = bounds.getSize(new THREE.Vector3())
        const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
        screenDistance = Math.max(size.y / (2 * tangent), size.x / (2 * tangent * camera.aspect)) * 1.08
      }
      reducedPlayMotion = reducedMotion
      playDestination = playing ? 1 : 0
      playDuration = reducedMotion ? 0.18 : 1.25
      if (!playing) stopAttract()
      return true
    },
    applyConfiguration(configuration) {
      handheld.applyConfiguration(configuration)
      environment.setPreset(configuration.scene)
    },
    reset() {
      stopAttract()
      controls.enableDamping = false
      controls.reset()
      controls.update()
      controls.enableDamping = true
      frameModel()
    },
    dispose() {
      disposed = true
      viewers.delete(container)
      resizeObserver.disconnect()
      pointerListeners.abort()
      renderer.setAnimationLoop(null)
      frameHandler = null
      playInspector = null
      controls.dispose()
      disposeModel(model)
      if (!model.getObjectByName('screen')) screenTexture?.dispose()
      title.dispose()
      container.closest('.viewport').classList.remove('title-ready')
      environment.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
