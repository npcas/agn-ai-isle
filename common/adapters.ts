import { AppSchema } from '../srv/db/schema'

export type AIAdapter = (typeof AI_ADAPTERS)[number]
export type ChatAdapter = (typeof CHAT_ADAPTERS)[number]
export type PersonaFormat = (typeof PERSONA_FORMATS)[number]

export type AdapterSetting = {
  /** The name of the field within the settings object */
  field: string

  /** The name as it appears in the Settings UI */
  label: string

  /** Any additional information about the setting (for UI only) */
  helperText?: string

  /** If this is a secret that should be encrypted */
  secret: boolean

  setting: SettingType
}

type SettingType =
  | { type: 'list'; options: Array<{ label: string; value: string }> }
  | { type: 'text'; placeholder?: string }
  | { type: 'boolean' }

export type AdapterOptions = {
  /** Name of the adapter that will be displayed in the UI */
  label: string
  settings: AdapterSetting[]
  options: Array<keyof PresetAISettings>
}

export const PERSONA_FORMATS = ['boostyle', 'wpp', 'sbf', 'text'] as const

export const PERSONA_LABELS: { [key in PersonaFormat]: string } = {
  boostyle: 'Boostyle',
  wpp: 'W++',
  sbf: 'SBF',
  text: 'Plain Text',
}

export const AI_ADAPTERS = [
  'kobold',
  'novel',
  'ooba',
  'horde',
  'luminai',
  'openai',
  'scale',
  'claude',
  'goose',
] as const
export const CHAT_ADAPTERS = ['default', ...AI_ADAPTERS] as const

export const MULTI_TENANT_ADAPTERS = ['novel', 'chai', 'kobold'] as const

export type NovelModel = keyof typeof NOVEL_MODELS

export type OpenAIModel = (typeof OPENAI_MODELS)[keyof typeof OPENAI_MODELS]

export const OPENAI_MODELS = {
  DaVinci: 'text-davinci-003',
  Turbo: 'gpt-3.5-turbo',
  Turbo0301: 'gpt-3.5-turbo-0301',
  GPT4: 'gpt-4',
  GPT4_0314: 'gpt-4-0314',
  GPT4_32k: 'gpt-4-32k',
  GPT4_32k_0314: 'gpt-4-32k-0314',
} as const

export const OPENAI_CHAT_MODELS: Record<string, boolean> = {
  [OPENAI_MODELS.Turbo]: true,
  [OPENAI_MODELS.Turbo0301]: true,
  [OPENAI_MODELS.GPT4]: true,
  [OPENAI_MODELS.GPT4_0314]: true,
  [OPENAI_MODELS.GPT4_32k]: true,
  [OPENAI_MODELS.GPT4_32k_0314]: true,
}

/** Note: claude-v1 and claude-instant-v1 not included as they may point
 * to different models in the future. New models may be less appropriate
 * for roleplaying so they should be updated to manually
 * <https://console.anthropic.com/docs/api/reference#-v1-complete>
 */
export const CLAUDE_MODELS = {
  ClaudeV1: 'claude-v1',
  ClaudeV1_100k: 'claude-v1-100k',
  ClaudeV1_0: 'claude-v1.0',
  ClaudeV1_2: 'claude-v1.2',
  ClaudeV1_3: 'claude-v1.3',
  ClaudeV1_3_100k: 'claude-v1.3-100k',
  ClaudeInstantV1: 'claude-instant-v1',
  ClaudeInstantV1_100k: 'claude-instant-v1-100k',
  ClaudeInstantV1_0: 'claude-instant-v1.0',
  ClaudeInstantV1_1: 'claude-instant-v1.1',
  ClaudeInstantV1_1_100k: 'claude-instant-v1.1-100k',
} as const

export const NOVEL_MODELS = {
  euterpe: 'euterpe-v2',
  krake: 'krake-v2',
  clio_v1: 'clio-v1',
} satisfies { [key: string]: string }

export type HordeModel = {
  name: string
  count: number
  performance: number
  queued: number
  eta: number
  type?: string
}

export type HordeWorker = {
  id: string
  name: string
  type: 'text' | 'image'
  online: number
  max_length: number
  max_context_length: number

  requests_fulfilled: number
  kudos_rewards: number
  kudos_details: {
    generated: number
    uptime?: number
  }
  performance: string
  threads: number
  uptime: number
  maintenance_mode: boolean
  nsfw: boolean
  trusted: boolean
  flagged: false
  uncompleted_jobs: number
  models: string[]
  team: {
    name?: string
    id?: string
  }
  bridge_agent: string
}

export const ADAPTER_LABELS: { [key in AIAdapter]: string } = {
  horde: 'Horde',
  kobold: 'Kobold / 3rd Party',
  novel: 'NovelAI',
  ooba: 'TextGen',
  luminai: 'LuminAI',
  openai: 'OpenAI',
  scale: 'Scale',
  claude: 'Claude',
  goose: 'Goose AI',
}

export type PresetAISettings = Omit<
  AppSchema.GenSettings,
  | 'name'
  | 'service'
  | 'images'
  | 'memoryDepth'
  | 'memoryContextLimit'
  | 'memoryReverseWeight'
  | 'src'
  | 'order'
  | 'useGaslight'
>

export const adapterSettings: {
  [key in keyof PresetAISettings]: AIAdapter[]
} = {
  temp: ['kobold', 'novel', 'ooba', 'horde', 'luminai', 'openai', 'scale', 'claude'],
  maxTokens: AI_ADAPTERS.slice(),
  maxContextLength: AI_ADAPTERS.slice(),
  gaslight: ['openai', 'novel', 'scale', 'kobold', 'claude', 'ooba', 'goose'],
  antiBond: ['openai', 'claude', 'scale'],
  ultimeJailbreak: ['openai', 'claude', 'kobold'],
  topP: ['horde', 'kobold', 'claude', 'ooba', 'openai', 'novel', 'luminai'],

  repetitionPenalty: ['horde', 'novel', 'kobold', 'ooba', 'luminai'],
  repetitionPenaltyRange: ['horde', 'novel', 'kobold', 'luminai'],
  repetitionPenaltySlope: ['horde', 'novel', 'kobold', 'luminai'],
  tailFreeSampling: ['horde', 'novel', 'kobold', 'luminai'],
  topA: ['horde', 'novel', 'kobold', 'luminai'],
  topK: ['horde', 'novel', 'kobold', 'ooba', 'luminai'],
  typicalP: ['horde', 'novel', 'kobold', 'ooba', 'luminai'],

  claudeModel: ['claude', 'kobold'],
  novelModel: ['novel'],
  oaiModel: ['openai', 'kobold'],
  frequencyPenalty: ['openai', 'kobold', 'novel'],
  presencePenalty: ['openai', 'kobold', 'novel'],
  streamResponse: ['openai', 'kobold', 'novel'],

  addBosToken: ['ooba'],
  banEosToken: ['ooba'],
  encoderRepitionPenalty: ['ooba'],
  penaltyAlpha: ['ooba'],
}

export type RegisteredAdapter = {
  name: AIAdapter
  settings: AdapterSetting[]
  options: Array<keyof PresetAISettings>
}
