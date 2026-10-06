import './style.css'
import { scenePreview } from './ui/scene-previews.js'
import { createPlayMode } from './play/play-mode.js'
import { createViewer } from './scene/viewer.js'

import { palettes, defaults, finishes, scenes, editions, selectedEdition, updateSelection, resolveConfiguration } from './configuration.js'

let configuration = { ...defaults }

const colorSection = (part, label) => `
  <section class="option-section" aria-labelledby="${part}-title">
    <div class="section-heading"><h2 id="${part}-title">${label}</h2>
    <span class="selection" data-selection="${part}"></span></div>
    <div class="swatches" role="group" aria-label="${label} color">
      ${palettes[part].map(color => `<button type="button" class="swatch" style="--swatch: ${color.value}" data-option="${part}" data-value="${color.name}" aria-label="${label}: ${color.name}" title="${color.name}" aria-pressed="false"></button>`).join('')}
    </div>
  </section>`

document.querySelector('#app').innerHTML = `
  <main class="workspace">
    <section class="viewport" aria-label="Interactive 3D preview">
      <div class="hero-type"><h1>GameBoy</h1></div>
      <div id="scene" class="scene"></div>
      <div class="viewport-footer">
        <div class="viewport-actions"><span class="eyebrow">YOUR NEXT DISTRACTION ↓</span><button type="button" id="play" class="play-launch" disabled><span aria-hidden="true">▶</span> ENTER GAME</button></div>
        <div class="view-notes"><span class="view-hint">Drag to rotate<br>Scroll to zoom</span></div>
      </div>
    </section>
    <aside class="sidebar" aria-labelledby="configurator-title">
      <div class="sidebar-intro"><h2 id="configurator-title">Make it yours</h2><p>Pick a world. Build a mood. Get lost in play.</p></div>
      <section class="option-section preset-section" aria-labelledby="scene-title">
        <div class="section-heading"><h2 id="scene-title">Scene</h2><span class="selection" data-selection="scene"></span></div>
        <div class="preset-buttons scene-buttons" role="group" aria-label="Scene">${Object.keys(scenes).map(name => `<button type="button" data-option="scene" data-value="${name}" aria-pressed="false">${scenePreview(name)}<span class="scene-name">${name}</span><span class="selected-tag" aria-hidden="true">SELECTED</span></button>`).join('')}</div>
      </section>
      <section class="option-section preset-section editions-section" aria-labelledby="editions-title">
        <div class="section-heading"><h2 id="editions-title">Edition</h2><span class="selection" id="edition-selection">Classic</span></div>
        <div class="preset-buttons edition-buttons" role="group" aria-label="Editions">${Object.keys(editions).map(name => `<button type="button" data-edition="${name}" aria-pressed="false"><span class="edition-chip" aria-hidden="true" style="--chip: ${resolveConfiguration({ ...defaults, ...editions[name] }).colors.body}; --chip-accent: ${resolveConfiguration({ ...defaults, ...editions[name] }).colors.buttons}"></span>${name}</button>`).join('')}</div>
      </section>
      ${colorSection('body', 'Body')}${colorSection('buttons', 'Buttons')}${colorSection('dpad', 'D-pad')}${colorSection('screen', 'Screen')}
      <section class="option-section material-section" aria-labelledby="material-title"><div class="section-heading"><h2 id="material-title">Material</h2><span class="selection" data-selection="material"></span></div><div class="materials" role="group" aria-label="Material">${Object.keys(finishes).map((material, i) => `<button type="button" data-option="material" data-value="${material}" aria-pressed="false"><span aria-hidden="true">${['●', '◕', '▧'][i]}</span>${material}</button>`).join('')}</div></section>
      <div class="sidebar-footer"><p class="placeholder-note">No wrong combinations.<br>Just your kind of weird.</p><button type="button" class="reset" id="reset"><span aria-hidden="true">↺</span> Reset</button></div>
    </aside>
  </main>`

let viewer
try {
  viewer = createViewer(document.querySelector('#scene'))
} catch (error) {
  document.querySelector('#scene').innerHTML = '<p class="scene-error" role="alert">The 3D preview could not start. Please try a browser with WebGL enabled.</p>'
  console.error('Could not initialize the 3D viewer:', error)
}

const playMode = viewer ? createPlayMode(viewer, document.querySelector('#app'), document.querySelector('#play')) : null

function applyConfiguration() {
  viewer?.applyConfiguration(resolveConfiguration(configuration))
  playMode?.setTheme(selectedEdition(configuration), resolveConfiguration(configuration).colors.screen)
}

function renderSelections() {
  const edition = selectedEdition(configuration)
  document.querySelector('#edition-selection').textContent = edition ?? 'Custom'
  document.querySelectorAll('[data-edition]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.edition === edition))
  })
  document.querySelectorAll('[data-option]').forEach(button => {
    button.setAttribute('aria-pressed', String(configuration[button.dataset.option] === button.dataset.value))
  })
  document.querySelectorAll('[data-selection]').forEach(label => {
    label.textContent = configuration[label.dataset.selection]
  })
}

const app = document.querySelector('#app')
function handleClick(event) {
  const button = event.target.closest('button')
  if (!button || button.id === 'play' || playMode?.active) return
  if (button.dataset.edition) configuration = updateSelection(configuration, { type: 'edition', value: button.dataset.edition })
  if (button.dataset.option) configuration = updateSelection(configuration, { type: 'option', key: button.dataset.option, value: button.dataset.value })
  if (button.id === 'reset') {
    configuration = updateSelection(configuration, { type: 'reset' })
    viewer?.reset()
  }
  applyConfiguration()
  renderSelections()
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelector('.hero-type h1').animate([
      { textShadow: '3px 0 #6973f4, -3px 0 #d7f553' },
      { textShadow: '-2px 0 #6973f4, 2px 0 #d7f553', offset: .45 },
      { textShadow: '0 0 transparent' },
    ], { duration: 180, easing: 'steps(2, end)' })
  }
}
app.addEventListener('click', handleClick)
applyConfiguration()
renderSelections()

if (import.meta.hot) import.meta.hot.dispose(() => {
  app.removeEventListener('click', handleClick)
  playMode?.dispose()
  viewer?.dispose()
})
