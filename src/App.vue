<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  createGame,
  stepGame,
  type GameInput,
  type GameState,
} from './game/logic'

const WIDTH = 1000
const HEIGHT = 600
const canvas = ref<HTMLCanvasElement | null>(null)
const state = ref<GameState>(createGame())
const input: GameInput = { left: false, right: false, thrust: false, fire: false }
const best = ref(readBest())
let previousTime = 0
let animationId = 0

const statusLabel = computed(() => {
  if (state.value.status === 'paused') return 'Flight paused'
  if (state.value.status === 'gameover') return 'Mission over'
  return state.value.status === 'ready' ? 'Ready for launch' : 'In flight'
})

function readBest() {
  try {
    return Number(localStorage.getItem('asteroids-best') || 0)
  } catch {
    return 0
  }
}

function startGame() {
  if (state.value.status === 'gameover') state.value = createGame()
  state.value.status = 'playing'
  previousTime = 0
}

function restartGame() {
  state.value = createGame()
  startGame()
}

function togglePause() {
  if (state.value.status === 'playing') state.value.status = 'paused'
  else if (state.value.status === 'paused') startGame()
}

function keyDown(event: KeyboardEvent) {
  const key = event.key.toLowerCase()
  if (['arrowleft', 'arrowright', 'arrowup', ' '].includes(key)) event.preventDefault()
  if (key === 'arrowleft' || key === 'a') input.left = true
  if (key === 'arrowright' || key === 'd') input.right = true
  if (key === 'arrowup' || key === 'w') input.thrust = true
  if (key === ' ') {
    input.fire = true
    if (state.value.status === 'ready') startGame()
  }
  if (key === 'escape') togglePause()
  if (key === 'r') restartGame()
  if (key === 'enter' && state.value.status !== 'playing') startGame()
}

function keyUp(event: KeyboardEvent) {
  const key = event.key.toLowerCase()
  if (key === 'arrowleft' || key === 'a') input.left = false
  if (key === 'arrowright' || key === 'd') input.right = false
  if (key === 'arrowup' || key === 'w') input.thrust = false
  if (key === ' ') input.fire = false
}

function clearInput() {
  input.left = false
  input.right = false
  input.thrust = false
  input.fire = false
}

function draw() {
  const context = canvas.value?.getContext('2d')
  if (!context) return
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  if (canvas.value!.width !== WIDTH * pixelRatio || canvas.value!.height !== HEIGHT * pixelRatio) {
    canvas.value!.width = WIDTH * pixelRatio
    canvas.value!.height = HEIGHT * pixelRatio
  }
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  context.clearRect(0, 0, WIDTH, HEIGHT)

  // Fixed, deliberately sparse star map gives the playfield a sense of scale.
  for (let i = 0; i < 76; i += 1) {
    const x = ((i * 197 + 61) % WIDTH)
    const y = ((i * 113 + 29) % HEIGHT)
    const alpha = 0.16 + ((i * 17) % 6) / 20
    context.fillStyle = `rgba(190, 220, 232, ${alpha})`
    context.fillRect(x, y, i % 9 === 0 ? 2 : 1.5, i % 9 === 0 ? 2 : 1.5)
  }

  for (const asteroid of state.value.asteroids) {
    context.save()
    context.translate(asteroid.x, asteroid.y)
    context.rotate(asteroid.angle)
    context.beginPath()
    asteroid.vertices.forEach((point, index) => {
      const x = Math.cos((Math.PI * 2 * index) / asteroid.vertices.length) * asteroid.radius * point
      const y = Math.sin((Math.PI * 2 * index) / asteroid.vertices.length) * asteroid.radius * point
      if (index === 0) context.moveTo(x, y)
      else context.lineTo(x, y)
    })
    context.closePath()
    context.strokeStyle = asteroid.size === 'small' ? '#a8c6d2' : '#d7e4e8'
    context.lineWidth = 1.8
    context.stroke()
    context.restore()
  }

  for (const bullet of state.value.bullets) {
    context.beginPath()
    context.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2)
    context.fillStyle = '#9ef6ff'
    context.shadowColor = '#54e3f4'
    context.shadowBlur = 12
    context.fill()
    context.shadowBlur = 0
  }

  const ship = state.value.ship
  if (ship.invulnerable <= 0 || Math.floor(ship.invulnerable * 10) % 2 === 0) {
    context.save()
    context.translate(ship.x, ship.y)
    context.rotate(ship.angle + Math.PI / 2)
    context.beginPath()
    context.moveTo(0, -18)
    context.lineTo(13, 15)
    context.lineTo(0, 10)
    context.lineTo(-13, 15)
    context.closePath()
    context.strokeStyle = '#effcff'
    context.lineWidth = 2
    context.shadowColor = '#b4f6ff'
    context.shadowBlur = 10
    context.stroke()
    if (input.thrust && state.value.status === 'playing') {
      context.beginPath()
      context.moveTo(-5, 14)
      context.lineTo(0, 25 + Math.random() * 8)
      context.lineTo(5, 14)
      context.strokeStyle = '#ffb86c'
      context.stroke()
    }
    context.restore()
  }
}

function animate(time: number) {
  if (previousTime === 0) previousTime = time
  const delta = Math.min((time - previousTime) / 1000, 0.04)
  previousTime = time
  if (state.value.status === 'playing') {
    stepGame(state.value, input, delta)
    if (state.value.score > best.value) {
      best.value = state.value.score
      try { localStorage.setItem('asteroids-best', String(best.value)) } catch { /* Storage is optional. */ }
    }
  }
  draw()
  animationId = requestAnimationFrame(animate)
}

onMounted(() => {
  window.addEventListener('keydown', keyDown)
  window.addEventListener('keyup', keyUp)
  window.addEventListener('blur', clearInput)
  animationId = requestAnimationFrame(animate)
})

onUnmounted(() => {
  window.removeEventListener('keydown', keyDown)
  window.removeEventListener('keyup', keyUp)
  window.removeEventListener('blur', clearInput)
  cancelAnimationFrame(animationId)
})
</script>

<template>
  <main class="site-shell">
    <header class="topbar">
      <a class="brand" href="#top" aria-label="Asteroids home">
        <span class="brand-mark" aria-hidden="true">✳</span>
        <span>ORBITAL<span class="brand-light"> / ARCADE</span></span>
      </a>
      <div class="topbar-right">
        <span class="live-indicator"><i></i> SYSTEM ONLINE</span>
        <span class="topbar-divider"></span>
        <span class="edition">NO. 01 <span>·</span> CLASSIC</span>
      </div>
    </header>

    <section class="game-layout" id="top">
      <aside class="intro-panel">
        <p class="eyebrow"><span>01</span> DEEP SPACE SURVIVAL</p>
        <h1>ASTEROID<br /><em>FIELD</em></h1>
        <p class="intro-copy">One ship. Endless space.<br />Make every shot count.</p>
        <div class="mission-note">
          <span class="note-rule"></span>
          <p>MISSION LOG <span>— 1979 / PRESENT</span></p>
          <small>Clear the field. Stay in orbit.</small>
        </div>
        <div class="key-guide">
          <p class="section-label">FLIGHT CONTROLS</p>
          <div class="key-row"><span class="keycap">←</span><span class="keycap">→</span><span>ROTATE</span><b>A / D</b></div>
          <div class="key-row"><span class="keycap wide">↑</span><span class="keycap ghost">&nbsp;</span><span>THRUST</span><b>W</b></div>
          <div class="key-row"><span class="keycap wide">SPACE</span><span class="key-label">FIRE</span><b>SPACE</b></div>
          <div class="key-row"><span class="keycap">ESC</span><span class="keycap ghost">&nbsp;</span><span>PAUSE</span><b>ESC</b></div>
        </div>
      </aside>

      <section class="console" aria-label="Asteroids game">
        <div class="console-topline">
          <span><i class="console-dot"></i> SECTOR 7G</span>
          <span class="console-center">FLIGHT SIMULATOR <b>///</b> 001</span>
          <span class="signal">SIGNAL <b>■■■■</b></span>
        </div>

        <div class="hud-bar">
          <div class="hud-stat"><span class="hud-label">SCORE</span><strong>{{ String(state.score).padStart(5, '0') }}</strong></div>
          <div class="hud-stat best-stat"><span class="hud-label">PERSONAL BEST</span><strong>{{ String(best).padStart(5, '0') }}</strong></div>
          <div class="hud-stat wave-stat"><span class="hud-label">WAVE</span><strong>{{ String(state.wave).padStart(2, '0') }}</strong></div>
          <div class="hud-stat lives-stat"><span class="hud-label">HULL</span><strong class="life-icons" :aria-label="`${state.lives} lives`">{{ '▲'.repeat(state.lives) }}<span>{{ '▲'.repeat(3 - state.lives) }}</span></strong></div>
        </div>

        <div class="screen-frame">
          <canvas ref="canvas" class="game-canvas" width="1000" height="600" aria-label="Asteroids playfield"></canvas>
          <div v-if="state.status !== 'playing'" class="screen-overlay" :class="`overlay-${state.status}`">
            <template v-if="state.status === 'ready'">
              <span class="overlay-kicker">{{ statusLabel }}</span>
              <h2>READY, PILOT?</h2>
              <p>Clear the asteroids. Keep moving.</p>
              <button class="launch-button" @click="startGame">START MISSION <span>↗</span></button>
              <small>OR PRESS SPACE</small>
            </template>
            <template v-else-if="state.status === 'paused'">
              <span class="overlay-kicker">FLIGHT SUSPENDED</span>
              <h2>PAUSED</h2>
              <p>Your ship is holding position.</p>
              <button class="launch-button" @click="startGame">RESUME FLIGHT <span>↗</span></button>
              <small>PRESS ESC TO RESUME</small>
            </template>
            <template v-else>
              <span class="overlay-kicker">END OF TRANSMISSION</span>
              <h2>MISSION OVER</h2>
              <p>Final score <strong>{{ String(state.score).padStart(5, '0') }}</strong></p>
              <button class="launch-button" @click="restartGame">FLY AGAIN <span>↗</span></button>
              <small>PRESS R TO RESTART</small>
            </template>
          </div>
          <div class="screen-coordinates">X: {{ Math.round(state.ship.x).toString().padStart(3, '0') }} <span>·</span> Y: {{ Math.round(state.ship.y).toString().padStart(3, '0') }}</div>
          <div class="screen-corner">REC <i></i></div>
        </div>

        <div class="console-footer">
          <span><i class="footer-pulse"></i> {{ statusLabel.toUpperCase() }}</span>
          <span class="footer-message">{{ state.status === 'playing' ? 'DESTROY ALL HOSTILES TO ADVANCE' : 'INSERT COIN? JUST PRESS START' }}</span>
          <button class="pause-button" :disabled="state.status === 'ready' || state.status === 'gameover'" @click="togglePause">{{ state.status === 'paused' ? 'RESUME' : 'PAUSE' }} <span>Ⅱ</span></button>
        </div>
      </section>
    </section>

    <section class="touch-controls" aria-label="Touch flight controls">
      <div class="touch-cluster">
        <button class="touch-button" aria-label="Rotate left" @pointerdown.prevent="input.left = true" @pointerup="input.left = false" @pointerleave="input.left = false" @pointercancel="input.left = false">↶</button>
        <button class="touch-button" aria-label="Rotate right" @pointerdown.prevent="input.right = true" @pointerup="input.right = false" @pointerleave="input.right = false" @pointercancel="input.right = false">↷</button>
      </div>
      <button class="touch-button thrust-button" aria-label="Thrust" @pointerdown.prevent="input.thrust = true" @pointerup="input.thrust = false" @pointerleave="input.thrust = false" @pointercancel="input.thrust = false">↑<small>THRUST</small></button>
      <button class="touch-button fire-button" aria-label="Fire" @pointerdown.prevent="input.fire = true; startGame()" @pointerup="input.fire = false" @pointerleave="input.fire = false" @pointercancel="input.fire = false">◎<small>FIRE</small></button>
    </section>

    <footer class="page-footer">
      <span>BUILT FOR THE VOID <b>·</b> PLAY FREE, FLY FOREVER</span>
      <span class="footer-center">A LITTLE NOSTALGIA. A LOT OF SPACE.</span>
      <a href="https://github.com/oscarmmi/asteroids" target="_blank" rel="noreferrer">SOURCE CODE <span>↗</span></a>
    </footer>
  </main>
</template>
