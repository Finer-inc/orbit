import { WorldServer } from './world/WorldServer.ts'
import { SpiritRuntime } from './spirit/SpiritRuntime.ts'
import { createConsoleLogger } from './cli/logger.ts'

async function main(): Promise<void> {
  const logger = createConsoleLogger()

  logger.worldEvent('Seirei World Server 起動中...')

  const world = new WorldServer()
  logger.worldEvent(`ワールド初期化完了: ${world.getAllObjects().length}個のオブジェクト`)
  logger.worldEvent(`現在の時間帯: ${world.getTimeOfDay()}`)

  const runtime = new SpiritRuntime(world, logger)

  // Add 2 test spirits at different positions
  runtime.addSpirit('spirit-1', 'Hikari', { position: [5, 0, 5], thinkIntervalMs: 3000 })
  runtime.addSpirit('spirit-2', 'Kaze', { position: [-5, 0, -5], thinkIntervalMs: 4000 })

  logger.worldEvent('精霊2体を配置完了')
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
    runtime.stop()
    process.exit(0)
  })
}

main().catch(console.error)
