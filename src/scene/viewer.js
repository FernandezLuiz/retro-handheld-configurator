import * as THREE from 'three'
import { createTitle } from './title.js'
import { createButtonInteraction } from './button-interaction.js'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { createPlaceholder } from './placeholder.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { centerModel, disposeModel } from './model-utils.js'
import { createHandheldController } from './handheld.js'
import { createEnvironment } from './environment.js'
import { createQuality } from './quality.js'

// Read-only diagnostics used by browser regression checks; no state mutations.
const viewers = new WeakMap()
export function inspectViewer(container) { return viewers.get(container)?.() }

export function createViewer(container) {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#eeefea')
  // A longer lens flattens the product like a studio shot and compresses the corridor.
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
  camera.position.set(4, 2.7, 6)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor('#eeefea')
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.08
  const quality = createQuality(renderer)
  renderer.setPixelRatio(quality.pixelRatio)
  renderer.shadowMap.enabled = quality.high
  renderer.shadowMap.type = THREE.PCFShadowMap
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
  // OrbitControls claims every touch gesture with an inline touch-action. CSS owns it
  // instead: outside Play Mode the browser keeps vertical pans, so the page scrolls.
  renderer.domElement.style.touchAction = ''

  const environment = createEnvironment(renderer, scene, container.closest('.viewport'))
  environment.setPreset('Arcade')
  const title = createTitle(scene, () => container.closest('.viewport').classList.add('title-ready'))
  title.setScene('Arcade')
  const pipeline = quality.createPipeline(scene, camera)
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
  // The product stands turned toward the corridor, showing its signature corner.
  const IDLE_YAW = -0.3
  let introStart = null
  const restingCamera = new THREE.Vector3()
  let pulseStart = null
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
  // Where the page scrolls past the viewer, a wheel scrolls it too. Trackpad pinches
  // arrive as ctrl+wheel and still zoom. Runs before OrbitControls' own wheel listener.
  const stackedLayout = window.matchMedia('(max-width: 900px), (pointer: coarse)')
  renderer.domElement.addEventListener('wheel', event => {
    if (stackedLayout.matches && !event.ctrlKey) event.stopImmediatePropagation()
  }, { capture: true, signal: pointerListeners.signal })
  // A vertical swipe reaches OrbitControls for a few frames before the browser claims
  // it as a page scroll. When that happens the orbit never happened: undo it whole.
  let touchOrigin = null
  renderer.domElement.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch' && event.isPrimary) touchOrigin = camera.position.clone()
  }, { capture: true, signal: pointerListeners.signal })
  renderer.domElement.addEventListener('pointercancel', event => {
    if (event.pointerType !== 'touch' || !touchOrigin || savedView) return
    controls.enableDamping = false
    controls.update()
    controls.enableDamping = true
    camera.position.copy(touchOrigin)
    restingCamera.copy(touchOrigin)
    touchOrigin = null
  }, { signal: pointerListeners.signal })

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
  let physicalInput = null
  let restoreResize = false
  let playProgress = 0
  let playDestination = 0
  let playDuration = 1.25
  let savedView = null
  let screenFocus = null
  let screenDistance = 1
  const playSize = new THREE.Vector3()
  const buttonInteraction = createButtonInteraction({
    element: renderer.domElement, camera, controls, reducedMotion,
    available: () => !disposed && (!savedView || (playProgress === 1 && playDestination === 1)),
    onAction: (...args) => physicalInput?.(...args),
    onInteraction: stopAttract,
  })

  function updatePlayCamera(dt) {
    if (!savedView) return
    // Square the product to the lens as the camera arrives at the screen.
    const settle = playProgress * playProgress * (3 - 2 * playProgress)
    productRoot.rotation.set(0, IDLE_YAW * (1 - settle), 0)
    productRoot.position.set(0, 0, 0)
    productRoot.scale.setScalar(1)
    pipeline.setPlayFocus(settle)
    playProgress = THREE.MathUtils.clamp(playProgress + (playDestination ? 1 : -1) * dt / playDuration, 0, 1)
    const t = playProgress * playProgress * (3 - 2 * playProgress)
    const size = playSize
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    // Short landscape screens put commands in the side margins, reserving only
    // a compact legend below the product rather than 220px of empty HUD space.
    const hudReserve = container.clientHeight <= 520 && camera.aspect > 1.4 ? 96 : 220
    screenDistance = Math.max(size.y / (2 * tangent), size.x / (2 * tangent * camera.aspect)) * Math.max(1.35, container.clientHeight / Math.max(120, container.clientHeight - hudReserve)) + size.z / 2
    const target = savedView.target.clone().lerp(screenFocus, t)
    const offset = savedView.position.clone().sub(savedView.target)
    const direction = offset.clone().normalize()
    // Rotate outside the shell before dollying inward, even from a rear view.
    const rotation = new THREE.Quaternion().setFromUnitVectors(direction, new THREE.Vector3(0, 0, 1))
    const travel = new THREE.Quaternion().slerp(rotation, Math.min(1, t / 0.65))
    direction.applyQuaternion(travel)
    const distance = THREE.MathUtils.lerp(offset.length(), screenDistance, t * t)
    camera.position.copy(target).addScaledVector(direction, distance)
    camera.lookAt(target)
    handheld.setScreenGlow(0.55 + t * 0.65)
    // Reduce cover-glass glare only while playing; restore the selected product exactly.
    for (const { material, values } of savedView.displayMaterials) for (const [key, value] of Object.entries(values)) {
      material[key] = THREE.MathUtils.lerp(value, key === 'ior' ? 1 : 0, t)
    }
    if (!playDestination && playProgress === 0) {
      camera.position.copy(savedView.position)
      camera.quaternion.copy(savedView.quaternion)
      controls.target.copy(savedView.target)
      controls.enabled = savedView.enabled
      savedView = null
    }
  }

  // Nearly on the corridor's axis, so the moon sits just off the product's shoulder.
  const defaultDirection = new THREE.Vector3(0.10, 0.075, 1).normalize()

  function frameModel(preserveView = false) {
    if (!framedRadius) return
    const vertical = THREE.MathUtils.degToRad(camera.fov / 2)
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect)
    // Portrait screens stack title, product and CTA, so height needs extra room;
    // width only needs a margin, which keeps narrow phones inside the scene's orbit.
    const distance = Math.max(framedRadius / Math.sin(vertical) * (camera.aspect < 0.8 ? 1.38 : 1.32), framedWidthRadius / Math.sin(horizontal) * 1.08)
    const offset = camera.position.clone().sub(controls.target)
    const zoomRatio = preserveView && fitDistance ? offset.length() / fitDistance : 1
    const direction = preserveView ? offset.normalize() : defaultDirection
    // Sit the product slightly low in frame: the title claims the upper third.
    const layoutOffset = framedRadius * (camera.aspect < 0.8 ? 0 : 0.09)
    controls.target.set(0, layoutOffset, 0)
    controls.minDistance = framedRadius * 1.3
    // Keep the fitted product view as the furthest view, with a little extra
    // presence so wheel zoom cannot shrink it behind the arcade room.
    controls.maxDistance = distance * 0.95
    camera.position.copy(direction).multiplyScalar(THREE.MathUtils.clamp(distance * zoomRatio, controls.minDistance, controls.maxDistance)).add(controls.target)
    // Printed marks sit 0.2 mm proud of the shell: keep depth precision for them.
    camera.near = framedRadius / 16
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
      loadedModel.traverse(object => {
        if (!object.isMesh || object.name.startsWith('internal_') || object.name === 'screen_glass') return
        object.castShadow = true
        object.receiveShadow = true
      })
      if (quality.high && !reducedMotion.matches) introStart = performance.now()
      framedRadius = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere()).radius
      const modelSize = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3())
      framedWidthRadius = Math.hypot(modelSize.x, modelSize.z) / 2
      frameModel()
      buttonInteraction.attach(model)
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
    pipeline.setSize(width, height)
    if (!savedView && !restoreResize) frameModel(true)
    restoreResize = false
  })
  resizeObserver.observe(container)
  renderer.setAnimationLoop(time => {
    // Keep the one existing loop, but do no GPU/simulation work in hidden tabs.
    // Reset the clock so returning cannot advance a transition by the hidden time.
    if (document.hidden) { previousTime = null; return }
    const elapsed = previousTime === null ? 0 : Math.max(0, (time - previousTime) / 1000)
    const dt = Math.min(elapsed, 0.1)
    previousTime = time
    quality.sample(elapsed, pipeline)
    if (savedView) updatePlayCamera(elapsed)
    else {
      pipeline.setPlayFocus(0)
      const shouldAttract = !reducedMotion.matches && !document.hidden && performance.now() - lastInteraction >= ATTRACT_DELAY
      if (shouldAttract !== attracting) {
        attracting = shouldAttract
        controls.autoRotate = attracting
        controls.autoRotateSpeed = 0.42
      }
      if (!buttonInteraction.active) {
        controls.update()
        // OrbitControls' spherical round trip adds float noise each frame. Below this
        // threshold the camera is at rest, so it stays exactly where it was.
        if (camera.position.distanceToSquared(restingCamera) < 1e-18) camera.position.copy(restingCamera)
        else restingCamera.copy(camera.position)
      }
      if (!reducedMotion.matches) {
        idleTime += dt
        pointer.lerp(pointerTarget, 1 - Math.exp(-dt * 3.5))
        const reach = quality.high ? 1 : .2
        const now = performance.now()
        const intro = introStart === null ? 1 : Math.min(1, (now - introStart) / 1700)
        const arrive = 1 - (1 - intro) ** 4
        if (intro === 1) introStart = null
        // A decaying swing acknowledges each change without moving the camera.
        const since = pulseStart === null ? Infinity : (now - pulseStart) / 1000
        const swing = since < 1.2 ? Math.exp(-since * 5) * Math.sin(since * 13) * .13 : 0
        if (since >= 1.2) pulseStart = null
        productRoot.position.y = (attracting ? Math.sin(idleTime * 0.7) * 0.03 : 0) - (1 - arrive) * .32
        productRoot.rotation.x = -pointer.y * 0.035 * reach
        productRoot.rotation.y = IDLE_YAW + pointer.x * 0.06 * reach + swing - (1 - arrive) * 1.05
        productRoot.rotation.z = 0
        productRoot.scale.setScalar(.92 + arrive * .08)
      } else {
        productRoot.position.set(0, 0, 0)
        productRoot.rotation.set(0, IDLE_YAW, 0)
        productRoot.scale.setScalar(1)
      }
    }
    title.update(camera, playProgress, idleTime, reducedMotion.matches)
    frameHandler?.(dt)
    buttonInteraction.update(dt)
    environment.update(dt, reducedMotion.matches)
    pipeline.render()
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
      productTop: (() => {
        const box = new THREE.Box3().setFromObject(model)
        let top = -Infinity
        for (const x of [box.min.x, box.max.x]) for (const z of [box.min.z, box.max.z]) top = Math.max(top, new THREE.Vector3(x, box.max.y, z).project(camera).y)
        return top
      })(),
      environments: environment.stats(),
      sceneObjects: scene.children.length,
      memory: { ...renderer.info.memory },
      quality: quality.inspect(),
      camera: camera.position.toArray(),
      product,
      controlsEnabled: controls.enabled,
      playProgress,
      liveScreen: Boolean(screenTexture?.isCanvasTexture),
      screenFlipY: screenTexture?.flipY,
      buttonFeedback: buttonInteraction.inspect(),
      buttonTargets: buttonInteraction.targets(),
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
    setPhysicalInput(handler) { physicalInput = handler },
    clearButtons() { buttonInteraction.clear() },
    pulseStart() { buttonInteraction.pulse('start') },
    preserveCameraOnResize() { restoreResize = true },
    setButtonFeedback: keys => buttonInteraction.setKeys(keys),
    get playProgress() { return playProgress },
    get attracting() { return attracting },
    setPlayMode(playing, reducedMotion = false) {
      if (playing && !savedView) {
        buttonInteraction.clear()
        stopAttract()
        const screen = model.getObjectByName('screen')
        if (!screen) return false
        savedView = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), target: controls.target.clone(), enabled: controls.enabled }
        savedView.displayMaterials = ['screen', 'screen_glass'].map(name => model.getObjectByName(name)?.material).filter(Boolean).map(material => ({
          material, values: Object.fromEntries(['ior', 'roughness', 'specularIntensity', 'envMapIntensity', 'clearcoat'].filter(key => typeof material[key] === 'number').map(key => [key, material[key]])),
        }))
        // Flush residual orbit damping without changing the saved view.
        controls.enableDamping = false
        controls.update()
        controls.enableDamping = true
        controls.enabled = false
        // Measure the product square-on: that is how the camera will frame it.
        productRoot.rotation.set(0, 0, 0)
        productRoot.position.set(0, 0, 0)
        productRoot.scale.setScalar(1)
        productRoot.updateMatrixWorld(true)
        const bounds = new THREE.Box3().setFromObject(model)
        productRoot.rotation.y = IDLE_YAW
        screenFocus = bounds.getCenter(new THREE.Vector3())
        bounds.getSize(playSize)
      }
      playDestination = playing ? 1 : 0
      playDuration = reducedMotion ? 0.18 : 1.25
      if (!playing) stopAttract()
      return true
    },
    applyConfiguration(configuration) {
      handheld.applyConfiguration(configuration)
      environment.setPreset(configuration.scene)
      title.setScene(configuration.scene)
      pipeline.setMood(container.closest('.viewport').dataset.mood === 'dark')
    },
    pulse() { if (quality.high && !reducedMotion.matches) pulseStart = performance.now() },
    reset() {
      buttonInteraction.clear()
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
      buttonInteraction.dispose()
      controls.dispose()
      disposeModel(model)
      if (!model.getObjectByName('screen')) screenTexture?.dispose()
      title.dispose()
      container.closest('.viewport').classList.remove('title-ready')
      environment.dispose()
      pipeline.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
