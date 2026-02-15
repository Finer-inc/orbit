import { existsSync } from 'node:fs'
import path from 'node:path'
import { WorldServer } from './world/WorldServer.ts'
import { createWorldMapFromGLB, createWorldMapFromJSON } from './world/WorldMap.ts'
import { SpiritRuntime } from './spirit/SpiritRuntime.ts'
import { createConsoleLogger } from './cli/logger.ts'
import { startApiServer } from './api.ts'

async function main(): Promise<void> {
  const logger = createConsoleLogger()

  logger.worldEvent('Seirei World Server 起動中...')

  const worldsDir = path.join(import.meta.dirname!, '..', 'public', 'worlds')
  const jsonPath = path.join(worldsDir, 'world.json')
  const glbPath = path.join(worldsDir, 'seirei-world.glb')

  let map
  if (existsSync(jsonPath)) {
    logger.worldEvent('world.json からワールド読み込み')
    map = createWorldMapFromJSON(jsonPath)
  } else {
    logger.worldEvent('GLB からワールド読み込み')
    map = createWorldMapFromGLB(glbPath)
  }
  const world = new WorldServer(map)
  logger.worldEvent(`ワールド初期化完了: ${world.getAllObjects().length}個のオブジェクト`)
  const dayLen = process.env.DAY_LENGTH_MINUTES
  logger.worldEvent(`1日の長さ: ${dayLen ?? '24'}分${dayLen ? '' : ' (デフォルト)'}`)
  logger.worldEvent(`現在の時間帯: ${world.getTimeOfDay()}`)

  // 移動ティックループ開始
  world.startMovementTick()

  // HTTP API サーバー起動
  startApiServer(world)

  const runtime = new SpiritRuntime(world, logger)

  if (process.env.TEST_SPIRITS) {
    runtime.addSpirit('spirit-1', 'Hikari', { position: [5, 0, 5], thinkIntervalMs: 3000 })
    runtime.addSpirit('spirit-2', 'Kaze', { position: [-5, 0, -5], thinkIntervalMs: 4000 })
    logger.worldEvent('テスト精霊2体を配置完了')
  }
  runtime.start()
  logger.worldEvent('思考ループ開始 (Ctrl+C で停止)')

  // Status display every 15 seconds
  const statusInterval = setInterval(() => {
    const snapshot = runtime.getSnapshot()
    logger.status(snapshot.spirits)
  }, 15000)

  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.worldEvent('シャットダウン中...')
    clearInterval(statusInterval)
    world.stopMovementTick()
    runtime.stop()
    process.exit(0)
  })
}

main().catch(console.error)
