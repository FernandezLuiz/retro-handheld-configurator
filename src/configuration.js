export const palettes = {
  body: [
    { name: 'Warm grey', value: '#c4c2b5' },
    { name: 'Frost', value: '#c5d4c8' },
    { name: 'Ink', value: '#303432' },
    { name: 'Stone', value: '#99988e' },
    { name: 'Moss', value: '#768267' },
    { name: 'Clay', value: '#b57360' },
  ],
  buttons: [
    { name: 'Burgundy', value: '#7d3345' },
    { name: 'Ink', value: '#303432' },
    { name: 'Chalk', value: '#e6e3dc' },
    { name: 'Moss', value: '#768267' },
    { name: 'Clay', value: '#b57360' },
  ],
  dpad: [
    { name: 'Charcoal', value: '#333836' },
    { name: 'Chalk', value: '#e6e3dc' },
    { name: 'Stone', value: '#99988e' },
    { name: 'Moss', value: '#768267' },
    { name: 'Clay', value: '#b57360' },
  ],
  screen: [
    { name: 'Muted green', value: '#617a57' },
    { name: 'Amber', value: '#b89043' },
    { name: 'Blue-grey', value: '#708b96' },
    { name: 'Dark', value: '#202c29' },
  ],
}
export const scenes = {
  Studio: { background: '#b4b6ae', glow: '#f7f8f3', key: '#ffffff', fill: '#eef0e8', ground: '#9a9d94', environment: 0.75, light: 2.0, dark: false },
  'Retro Desk': { background: '#2a1b14', glow: '#f0e2c9', key: '#ffe9cc', fill: '#e8dac6', ground: '#5d4230', environment: 0.8, light: 3.1, dark: true },
  Arcade: { background: '#0d0620', glow: '#34204b', key: '#fff1e6', fill: '#d88bdb', ground: '#3b2450', environment: 0.85, light: 3.1, dark: true },
  'Dark Tech': { background: '#05090e', glow: '#3a4a50', key: '#eef7ff', fill: '#96b7b4', ground: '#1c2a31', environment: 0.8, light: 3.0, dark: true },
}
export const editions = {
  Classic: { body: 'Warm grey', buttons: 'Burgundy', dpad: 'Charcoal', screen: 'Muted green', material: 'Matte' },
  Atomic: { body: 'Frost', buttons: 'Clay', dpad: 'Charcoal', screen: 'Blue-grey', material: 'Translucent' },
  Forest: { body: 'Moss', buttons: 'Chalk', dpad: 'Stone', screen: 'Muted green', material: 'Matte' },
  Sunset: { body: 'Clay', buttons: 'Burgundy', dpad: 'Chalk', screen: 'Amber', material: 'Glossy' },
  Stealth: { body: 'Ink', buttons: 'Ink', dpad: 'Charcoal', screen: 'Dark', material: 'Glossy' },
}
export const defaults = { ...editions.Classic, scene: 'Arcade' }
export const finishes = {
  Matte: { roughness: 0.72, metalness: 0, clearcoat: 0, clearcoatRoughness: 0.3, transmission: 0, thickness: 0, ior: 1.46, envMapIntensity: 0.55, specularIntensity: 0.5 },
  Glossy: { roughness: 0.26, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, transmission: 0, thickness: 0, ior: 1.46, envMapIntensity: 1, specularIntensity: 0.9 },
  // Thickness is measured in the GLB's meters, not the normalized viewer units.
  Translucent: { roughness: 0.25, metalness: 0, clearcoat: 0, clearcoatRoughness: 0.4, transmission: 0.84, thickness: 0.0025, ior: 1.46, envMapIntensity: 0.62, specularIntensity: 0.7 },
}
export function selectedEdition(selection) {
  return Object.keys(editions).find(name => Object.entries(editions[name]).every(([key, value]) => selection[key] === value)) ?? null
}
export function updateSelection(selection, action) {
  if (action.type === 'reset') return { ...defaults }
  if (action.type === 'edition') return { ...selection, ...editions[action.value] }
  return { ...selection, [action.key]: action.value }
}
export function resolveConfiguration(selection) {
  return {
    colors: Object.fromEntries(Object.entries(palettes).map(([part, palette]) => [part, palette.find(color => color.name === selection[part]).value])),
    material: selection.material,
    scene: selection.scene ?? defaults.scene,
  }
}
