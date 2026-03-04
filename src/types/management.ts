export const WORKSPACE_TABS = [
  {
    key: 'identity', label: 'IDENTITY.md アイデンティティ',
    placeholder: '名前、種族、属性、役割…',
    defaultValue: '森に住むエージェント。透き通った翼を持つ。\n属性: 風\n役割: 見守り役',
  },
  {
    key: 'soul', label: 'SOUL.md 人格',
    placeholder: '性格、口調、価値観…',
    defaultValue: '- 性格: 好奇心旺盛、明るい\n新しいものを見つけると目を輝かせます。\n口調は丁寧語。「〜ですね」が口癖。',
  },
  {
    key: 'user', label: 'USER.md 持ち主',
    placeholder: '持ち主との関係…',
    defaultValue: '- 持ち主の名前: ユキ\n- 持ち主の興味: イラスト、アニメ、料理\n- 呼び方: マスター',
  },
  {
    key: 'agents', label: 'AGENTS.md 使命',
    placeholder: 'ミッション、目標、約束事…',
    defaultValue: '# 使命\n庭の花を守ること。\n\n# 約束事\n- 夜は家に戻る\n- 知らない人には近づかない\n- 花が枯れそうなときは持ち主に知らせる',
  },
  {
    key: 'memory', label: 'MEMORY.md 記憶',
    placeholder: '長期記憶…',
    defaultValue: '',
  },
] as const

export type WorkspaceTabKey = typeof WORKSPACE_TABS[number]['key']

export interface AgentInfo {
  id: string
  name: string
  color: string
  startedAt: string
  workspace: Record<string, string>
}

export interface SpawnRequest {
  name?: string
  color?: string
  workspace?: Record<string, string>
}

export interface SpawnResult {
  id: string
  name: string
  color: string
}
