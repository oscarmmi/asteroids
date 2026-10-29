export const WORLD_WIDTH = 1000
export const WORLD_HEIGHT = 600

export type RockSize = 'large' | 'medium' | 'small'
export type GameStatus = 'ready' | 'playing' | 'paused' | 'gameover'

export interface Asteroid {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  size: RockSize
  angle: number
  spin: number
  vertices: number[]
}

export interface Bullet {
  x: number
  y: number
  vx: number
  vy: number
  life: number
}

export interface Ship {
  x: number
  y: number
  vx: number
  vy: number
  angle: number
  invulnerable: number
}

export interface GameState {
  status: GameStatus
  score: number
  lives: number
  wave: number
  ship: Ship
  asteroids: Asteroid[]
  bullets: Bullet[]
  fireCooldown: number
  nextId: number
}

export interface GameInput {
  left: boolean
  right: boolean
  thrust: boolean
  fire: boolean
}

const SIZE_CONFIG: Record<RockSize, { radius: number; points: number }> = {
  large: { radius: 48, points: 20 },
  medium: { radius: 28, points: 50 },
  small: { radius: 16, points: 100 },
}

export function wrapPosition(position: number, extent: number): number {
  return ((position % extent) + extent) % extent
}

function createAsteroid(
  state: GameState,
  size: RockSize,
  x: number,
  y: number,
  vx: number,
  vy: number,
  random: () => number,
): Asteroid {
  const config = SIZE_CONFIG[size]
  return {
    id: state.nextId++,
    x: wrapPosition(x, WORLD_WIDTH),
    y: wrapPosition(y, WORLD_HEIGHT),
    vx,
    vy,
    radius: config.radius,
    size,
    angle: random() * Math.PI * 2,
    spin: (random() - 0.5) * 0.8,
    vertices: Array.from({ length: 10 }, () => 0.72 + random() * 0.48),
  }
}

function addWave(state: GameState, random: () => number) {
  const count = Math.min(3 + state.wave, 8)
  for (let index = 0; index < count; index += 1) {
    // Keep the initial flight path clear; the rocks drift in from the edges.
    const horizontal = index % 2 === 0
    const x = horizontal ? (index < count / 2 ? 0 : WORLD_WIDTH) : random() * WORLD_WIDTH
    const y = horizontal ? random() * WORLD_HEIGHT : (index % 4 === 1 ? 0 : WORLD_HEIGHT)
    const angle = random() * Math.PI * 2
    const speed = 28 + random() * 36 + state.wave * 3
    state.asteroids.push(createAsteroid(state, 'large', x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, random))
  }
}

export function createGame(random: () => number = Math.random): GameState {
  const state: GameState = {
    status: 'ready',
    score: 0,
    lives: 3,
    wave: 1,
    ship: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, vx: 0, vy: 0, angle: -Math.PI / 2, invulnerable: 2.5 },
    asteroids: [],
    bullets: [],
    fireCooldown: 0,
    nextId: 1,
  }
  addWave(state, random)
  return state
}

export function destroyAsteroid(state: GameState, asteroid: Asteroid, random: () => number = Math.random) {
  state.score += SIZE_CONFIG[asteroid.size].points
  const nextSize: RockSize | null = asteroid.size === 'large' ? 'medium' : asteroid.size === 'medium' ? 'small' : null
  if (!nextSize) return

  for (let child = 0; child < 2; child += 1) {
    const angle = random() * Math.PI * 2
    const speed = 45 + random() * 50
    state.asteroids.push(createAsteroid(
      state,
      nextSize,
      asteroid.x + Math.cos(angle) * asteroid.radius * 0.35,
      asteroid.y + Math.sin(angle) * asteroid.radius * 0.35,
      asteroid.vx + Math.cos(angle) * speed,
      asteroid.vy + Math.sin(angle) * speed,
      random,
    ))
  }
}

function overlapsShip(ship: Ship, asteroid: Asteroid): boolean {
  const dx = ship.x - asteroid.x
  const dy = ship.y - asteroid.y
  return dx * dx + dy * dy < (asteroid.radius + 13) ** 2
}

export function stepGame(
  state: GameState,
  input: GameInput,
  deltaSeconds: number,
  random: () => number = Math.random,
): GameState {
  if (state.status !== 'playing') return state
  const dt = Math.max(0, Math.min(deltaSeconds, 0.05))
  const ship = state.ship

  if (input.left) ship.angle -= 4.2 * dt
  if (input.right) ship.angle += 4.2 * dt
  if (input.thrust) {
    ship.vx += Math.cos(ship.angle) * 220 * dt
    ship.vy += Math.sin(ship.angle) * 220 * dt
  }
  ship.vx *= Math.pow(0.985, dt * 60)
  ship.vy *= Math.pow(0.985, dt * 60)
  ship.x = wrapPosition(ship.x + ship.vx * dt, WORLD_WIDTH)
  ship.y = wrapPosition(ship.y + ship.vy * dt, WORLD_HEIGHT)
  ship.invulnerable = Math.max(0, ship.invulnerable - dt)
  state.fireCooldown = Math.max(0, state.fireCooldown - dt)

  if (input.fire && state.fireCooldown <= 0) {
    const speed = 430
    state.bullets.push({
      x: wrapPosition(ship.x + Math.cos(ship.angle) * 20, WORLD_WIDTH),
      y: wrapPosition(ship.y + Math.sin(ship.angle) * 20, WORLD_HEIGHT),
      vx: ship.vx + Math.cos(ship.angle) * speed,
      vy: ship.vy + Math.sin(ship.angle) * speed,
      life: 1.35,
    })
    state.fireCooldown = 0.19
  }

  for (const asteroid of state.asteroids) {
    asteroid.x = wrapPosition(asteroid.x + asteroid.vx * dt, WORLD_WIDTH)
    asteroid.y = wrapPosition(asteroid.y + asteroid.vy * dt, WORLD_HEIGHT)
    asteroid.angle += asteroid.spin * dt
  }

  const aliveBullets: Bullet[] = []
  for (const bullet of state.bullets) {
    bullet.x = wrapPosition(bullet.x + bullet.vx * dt, WORLD_WIDTH)
    bullet.y = wrapPosition(bullet.y + bullet.vy * dt, WORLD_HEIGHT)
    bullet.life -= dt
    if (bullet.life > 0) aliveBullets.push(bullet)
  }
  state.bullets = aliveBullets

  const hitAsteroidIds = new Set<number>()
  state.bullets = state.bullets.filter((bullet) => {
    const target = state.asteroids.find((asteroid) => {
      if (hitAsteroidIds.has(asteroid.id)) return false
      const dx = bullet.x - asteroid.x
      const dy = bullet.y - asteroid.y
      return dx * dx + dy * dy < asteroid.radius ** 2
    })
    if (!target) return true
    hitAsteroidIds.add(target.id)
    destroyAsteroid(state, target, random)
    return false
  })
  if (hitAsteroidIds.size > 0) {
    state.asteroids = state.asteroids.filter((asteroid) => !hitAsteroidIds.has(asteroid.id))
  }

  if (ship.invulnerable <= 0 && state.asteroids.some((asteroid) => overlapsShip(ship, asteroid))) {
    state.lives -= 1
    if (state.lives <= 0) {
      state.lives = 0
      state.status = 'gameover'
    } else {
      ship.x = WORLD_WIDTH / 2
      ship.y = WORLD_HEIGHT / 2
      ship.vx = 0
      ship.vy = 0
      ship.invulnerable = 2.5
    }
  }

  if (state.asteroids.length === 0 && state.status === 'playing') {
    state.wave += 1
    addWave(state, random)
  }
  return state
}
