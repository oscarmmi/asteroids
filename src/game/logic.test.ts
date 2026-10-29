import { describe, expect, it } from 'vitest'
import { createGame, stepGame, wrapPosition, type Asteroid } from './logic'

const noInput = { left: false, right: false, thrust: false, fire: false }
const fixedRandom = () => 0.5

describe('Asteroids game logic', () => {
  it('splits a large asteroid into two medium asteroids when hit by a bullet', () => {
    const game = createGame(fixedRandom)
    game.status = 'playing'
    game.ship.x = 700
    game.ship.y = 500
    const target: Asteroid = {
      id: 999,
      x: 200,
      y: 180,
      vx: 0,
      vy: 0,
      radius: 48,
      size: 'large',
      angle: 0,
      spin: 0,
      vertices: Array(10).fill(1),
    }
    game.asteroids = [target]
    game.bullets = [{ x: 200, y: 180, vx: 0, vy: 0, life: 1 }]

    stepGame(game, noInput, 0.01, fixedRandom)

    expect(game.asteroids).toHaveLength(2)
    expect(game.asteroids.every((asteroid) => asteroid.size === 'medium')).toBe(true)
    expect(game.score).toBe(20)
    expect(game.bullets).toHaveLength(0)
  })

  it('wraps a position past the right edge to the left edge', () => {
    expect(wrapPosition(1007, 1000)).toBe(7)
    expect(wrapPosition(-7, 1000)).toBe(993)
  })

  it('costs a life when an asteroid overlaps the unshielded ship', () => {
    const game = createGame(fixedRandom)
    game.status = 'playing'
    game.ship.x = 500
    game.ship.y = 300
    game.ship.invulnerable = 0
    game.asteroids = [{
      id: 888,
      x: 500,
      y: 300,
      vx: 0,
      vy: 0,
      radius: 16,
      size: 'small',
      angle: 0,
      spin: 0,
      vertices: Array(10).fill(1),
    }]

    stepGame(game, noInput, 0.01, fixedRandom)

    expect(game.lives).toBe(2)
    expect(game.ship.invulnerable).toBeGreaterThan(0)
    expect(game.ship.x).toBe(500)
    expect(game.ship.y).toBe(300)
  })
})
