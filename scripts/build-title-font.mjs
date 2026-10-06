// Subset the existing OFL-licensed Syne face for offline Three.js text geometry.
import opentype from 'opentype.js'
import { readFileSync, writeFileSync } from 'node:fs'
const bytes = readFileSync(new URL('../public/fonts/syne-800.ttf', import.meta.url))
const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
const glyphs = {}
for (const character of new Set('GameBoy?')) {
  const glyph = font.charToGlyph(character)
  const outline = glyph.path.commands.map(command => {
    const parts = [command.type === 'C' ? 'b' : command.type.toLowerCase()]
    for (const suffix of ['', '1', '2']) if (command[`x${suffix}`] !== undefined) parts.push(command[`x${suffix}`], command[`y${suffix}`])
    return parts.join(' ')
  }).join(' ')
  glyphs[character] = { ha: glyph.advanceWidth, x_min: glyph.xMin, x_max: glyph.xMax, o: outline }
}
writeFileSync(new URL('../public/fonts/syne-title.json', import.meta.url), JSON.stringify({ glyphs, familyName: 'Syne', resolution: font.unitsPerEm, boundingBox: { yMin: font.descender, yMax: font.ascender }, underlineThickness: 0 }))
