import * as THREE from 'three'

const actions = { button_a: 'action', button_b: 'boost', start_button: 'start', select_button: 'select' }

// Owns only the controls' temporary transforms. Uses the viewer's existing clock.
export function createButtonInteraction({ element, camera, controls, available, reducedMotion, onInteraction }) {
  const lifetime = new AbortController()
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const pointers = new Map()
  let model, entries = [], keys = new Set(), orbitWasEnabled = true

  function hit(event) {
    if (!model || !available()) return null
    const bounds = element.getBoundingClientRect()
    ndc.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1)
    model.updateWorldMatrix(true, true)
    raycaster.setFromCamera(ndc, camera)
    // Test the whole product so the shell occludes buttons when viewed from behind.
    const intersection = raycaster.intersectObject(model, true).find(({ object }) => {
      for (let node = object; node; node = node.parent) if (!node.visible) return false
      return true
    })
    const entry = entries.find(item => item.mesh === intersection?.object)
    if (!entry) return null
    let action = actions[entry.mesh.name]
    if (entry.mesh.name === 'dpad') {
      const local = entry.mesh.worldToLocal(intersection.point.clone()).sub(entry.center)
      action = Math.abs(local.x) > Math.abs(local.y) ? (local.x > 0 ? 'right' : 'left') : (local.y > 0 ? 'up' : 'down')
    }
    return { entry, action }
  }
  function release(event) {
    if (!pointers.has(event.pointerId)) return
    onInteraction()
    pointers.delete(event.pointerId)
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId)
    if (!pointers.size) controls.enabled = orbitWasEnabled
    element.style.cursor = ''
  }
  function clear() {
    for (const pointerId of [...pointers.keys()]) release({ pointerId })
    keys.clear()
    for (const entry of entries) {
      entry.until = 0; entry.press = 0; entry.x = 0; entry.y = 0
      entry.mesh.position.copy(entry.position)
      entry.mesh.quaternion.copy(entry.quaternion)
    }
    element.style.cursor = ''
  }
  element.addEventListener('pointerdown', event => {
    if (event.button !== 0) return
    const target = hit(event)
    if (!target && !pointers.size) return
    // Capture phase intercepts button presses before OrbitControls can start a drag.
    event.preventDefault(); event.stopImmediatePropagation()
    if (!target) return
    onInteraction()
    if (!pointers.size) orbitWasEnabled = controls.enabled
    controls.enabled = false
    target.entry.until = performance.now() + (reducedMotion.matches ? 0 : 90)
    target.entry.action = target.action
    pointers.set(event.pointerId, target)
    element.setPointerCapture(event.pointerId)
    element.style.cursor = 'pointer'
    update(1 / 60)
  }, { capture: true, signal: lifetime.signal })
  element.addEventListener('pointermove', event => {
    if (pointers.size) { onInteraction(); event.stopImmediatePropagation(); return }
    if (event.pointerType === 'mouse' && !event.buttons) element.style.cursor = hit(event) ? 'pointer' : ''
  }, { capture: true, signal: lifetime.signal })
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    element.addEventListener(type, release, { capture: true, signal: lifetime.signal })
  }
  window.addEventListener('blur', clear, { signal: lifetime.signal })

  function update(dt) {
    const active = new Set(keys)
    for (const { action } of pointers.values()) active.add(action)
    for (const entry of entries) if (entry.until > performance.now()) active.add(entry.action)
    for (const entry of entries) {
      const dpad = entry.mesh.name === 'dpad'
      const pressed = dpad ? ['left', 'right', 'up', 'down'].some(key => active.has(key)) : active.has(actions[entry.mesh.name])
      const blend = reducedMotion.matches ? 1 : 1 - Math.exp(-dt * (pressed ? 65 : 32))
      const approach = (value, target) => Math.abs(value - target) < .001 ? target : THREE.MathUtils.lerp(value, target, blend)
      entry.press = approach(entry.press, Number(pressed))
      entry.x = approach(entry.x, dpad ? Number(active.has('down')) - Number(active.has('up')) : 0)
      entry.y = approach(entry.y, dpad ? Number(active.has('right')) - Number(active.has('left')) : 0)
      entry.mesh.position.copy(entry.position)
      entry.mesh.quaternion.copy(entry.quaternion)
      if (dpad) {
        const tilt = new THREE.Quaternion().setFromEuler(new THREE.Euler(entry.x * .045, entry.y * .045, 0))
        entry.mesh.quaternion.multiply(tilt)
        entry.mesh.position.add(entry.center).sub(entry.center.clone().applyQuaternion(tilt))
      }
      entry.mesh.position.z -= entry.press * (dpad ? .0003 : .00065)
    }
  }
  return {
    attach(loaded) {
      clear(); model = loaded
      entries = ['dpad', ...Object.keys(actions)].map(name => {
        const mesh = model.getObjectByName(name)
        if (!mesh?.isMesh) return null
        mesh.geometry.computeBoundingBox()
        return { mesh, position: mesh.position.clone(), quaternion: mesh.quaternion.clone(), center: mesh.geometry.boundingBox.getCenter(new THREE.Vector3()), press: 0, x: 0, y: 0, until: 0 }
      }).filter(Boolean)
    },
    update, clear,
    setKeys(value) { keys = new Set(value); update(1 / 60) },
    get active() { return pointers.size > 0 },
    inspect() { return entries.map(({ mesh }) => ({ name: mesh.name, position: mesh.position.toArray(), quaternion: mesh.quaternion.toArray() })) },
    targets() {
      return entries.map(({ mesh, center }) => ({ name: mesh.name, ndc: mesh.localToWorld(center.clone()).project(camera).toArray() }))
    },
    dispose() { clear(); lifetime.abort() },
  }
}
