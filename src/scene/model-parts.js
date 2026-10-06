// Exact mesh names from retro-handheld.glb. Unlisted meshes stay unchanged.
export const MODEL_PARTS = {
  body: ['body', 'back_panel'],
  buttons: ['button_a', 'button_b'],
  dpad: ['dpad'],
  screen: ['screen'],
}

export function inspectModel(model) {
  const inventory = []
  model.traverse(mesh => {
    if (!mesh.isMesh) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    materials.forEach((material, slot) => inventory.push({
      mesh: mesh.name,
      material: material.name,
      slot,
      slotCount: materials.length,
      multipleSlots: Array.isArray(mesh.material),
      textured: Boolean(material.map),
    }))
  })
  return inventory
}
