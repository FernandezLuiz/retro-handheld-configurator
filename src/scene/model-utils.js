import * as THREE from 'three'

export function disposeModel(model) {
  const resources = new Set()
  model.traverse(object => {
    if (object.geometry) resources.add(object.geometry)
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of materials) {
      if (!material) continue
      resources.add(material)
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value)
    }
  })
  resources.forEach(resource => resource.dispose())
}

export function centerModel(model) {
  model.updateMatrixWorld(true)
  const bounds = new THREE.Box3().setFromObject(model)
  const size = bounds.getSize(new THREE.Vector3())
  const longestSide = Math.max(size.x, size.y, size.z)
  if (!Number.isFinite(longestSide) || longestSide <= 0) throw new Error('The model has no visible bounds.')
  const wrapper = new THREE.Group()
  wrapper.add(model)
  wrapper.scale.setScalar(3 / longestSide)
  wrapper.position.copy(bounds.getCenter(new THREE.Vector3())).multiplyScalar(-3 / longestSide)
  return wrapper
}

