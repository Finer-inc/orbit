import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import type { WorldServer } from './world/WorldServer.ts'

export function startApiServer(world: WorldServer): void {
  const app = new Hono()

  // --- Spirit registration ---

  app.post('/api/spirits/register', async (c) => {
    const { id, name, position, color } = await c.req.json<{
      id: string
      name: string
      position: [number, number, number]
      color?: string
    }>()
    const state = world.registerSpirit(id, name, position, color)
    return c.json(state)
  })

  app.delete('/api/spirits/:id', (c) => {
    world.unregisterSpirit(c.req.param('id'))
    return c.json({ ok: true })
  })

  // --- Spirit queries ---

  app.get('/api/spirits', (c) => {
    return c.json(world.getAllSpirits())
  })

  app.get('/api/spirits/:id', (c) => {
    const state = world.getSpiritState(c.req.param('id'))
    if (!state) return c.json({ error: 'not found' }, 404)
    return c.json(state)
  })

  // --- Spirit actions ---

  app.post('/api/spirits/:id/observe', (c) => {
    const result = world.observe(c.req.param('id'))
    return c.json(result)
  })

  app.post('/api/spirits/:id/move', async (c) => {
    const { targetX, targetZ } = await c.req.json<{
      targetX: number
      targetZ: number
    }>()
    const result = world.moveSpirit(c.req.param('id'), targetX, targetZ)
    return c.json(result)
  })

  app.post('/api/spirits/:id/walk', async (c) => {
    const { targetX, targetZ } = await c.req.json<{
      targetX: number
      targetZ: number
    }>()
    const result = world.walkTo(c.req.param('id'), targetX, targetZ)
    return c.json(result)
  })

  app.post('/api/spirits/:id/stop', (c) => {
    const result = world.stopWalking(c.req.param('id'))
    return c.json(result)
  })

  app.post('/api/spirits/:id/look_at', async (c) => {
    const { targetX, targetZ } = await c.req.json<{
      targetX: number
      targetZ: number
    }>()
    const result = world.lookAt(c.req.param('id'), targetX, targetZ)
    return c.json(result)
  })

  app.post('/api/spirits/:id/say', async (c) => {
    const { message, volume, to } = await c.req.json<{
      message: string
      volume: 'whisper' | 'normal' | 'shout'
      to?: string
    }>()
    const result = world.say(c.req.param('id'), message, volume ?? 'normal', to)
    return c.json(result)
  })

  // --- Spirit behavior ---

  app.patch('/api/spirits/:id/state', async (c) => {
    const { state, goal, subgoal } = await c.req.json<{
      state?: 'idle' | 'active' | 'conversing' | 'resting'
      goal?: string
      subgoal?: string
    }>()
    const spirit = world.updateSpiritBehavior(c.req.param('id'), { state, goal, subgoal })
    if (!spirit) return c.json({ error: 'not found' }, 404)
    return c.json(spirit)
  })

  app.patch('/api/spirits/:id/energy', async (c) => {
    const { mentalEnergy, maxMentalEnergy } = await c.req.json<{
      mentalEnergy: number
      maxMentalEnergy: number
    }>()
    const spirit = world.updateSpiritEnergy(c.req.param('id'), mentalEnergy, maxMentalEnergy)
    if (!spirit) return c.json({ error: 'not found' }, 404)
    return c.json(spirit)
  })

  // --- World info ---

  app.get('/api/world/time', (c) => {
    return c.json({ timeOfDay: world.getTimeOfDay(), hour: world.getHour(), timeScale: world.getTimeScale() })
  })

  app.get('/api/world/beds', (c) => {
    return c.json(world.getBeds())
  })

  app.get('/api/world/objects', (c) => {
    return c.json(world.getAllObjects())
  })

  app.get('/api/world/objects/:id', (c) => {
    const obj = world.getObjectById(c.req.param('id'))
    if (!obj) return c.json({ error: 'not found' }, 404)
    return c.json(obj)
  })

  app.get('/api/world/bounds', (c) => {
    return c.json(world.getBounds())
  })

  app.get('/api/world/terrain', (c) => {
    return c.json(world.getTerrainHeightmap())
  })

  // --- Path graph ---

  app.get('/api/world/pathgraph', (c) => {
    const nodes = world.getPathNodes()
    if (!nodes) return c.json({ error: 'no pathgraph loaded' }, 404)
    return c.json(nodes)
  })

  app.post('/api/spirits/:id/navigate', async (c) => {
    const { targetNodeId } = await c.req.json<{ targetNodeId: string }>()
    const result = world.navigateTo(c.req.param('id'), targetNodeId)
    return c.json(result)
  })

  app.get('/api/spirits/:id/navigation', (c) => {
    const status = world.getNavigationStatus(c.req.param('id'))
    if (!status) return c.json({ error: 'not found' }, 404)
    return c.json(status)
  })

  // --- Spawn zones ---

  app.get('/api/world/spawn-point', (c) => {
    return c.json({ position: world.getRandomSpawnPoint() })
  })

  app.get('/api/world/spawnzones', (c) => {
    const zones = world.getSpawnZones()
    if (!zones) return c.json({ error: 'no spawn zones loaded' }, 404)
    return c.json(zones)
  })

  // --- Start ---

  const PORT = Number(process.env.PORT) || 3001

  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`>>> API サーバー起動: http://localhost:${info.port}`)
  })
}
