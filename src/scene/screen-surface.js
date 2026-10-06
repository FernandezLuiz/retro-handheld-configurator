import * as THREE from 'three'

// Tiny neutral luminance map: selected screen colors remain the source of tint.
// Mipmapping fades the subpixel pattern at normal viewing distances.
export function createLCDTexture() {
  const size = 64, data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const value = x % 8 === 0 || y % 8 === 0 ? 242 : 255
    const i = (y * size + x) * 4
    data.set([value, value, value, 255], i)
  }
  const texture = new THREE.DataTexture(data, size, size)
  texture.name = 'subtle_lcd_pixel_grid'
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(20, 15)
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}
