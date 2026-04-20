import { describe, expect, test } from 'bun:test'

import { autoApplyProviderIfNeeded } from './providerAutoApply.ts'

const noLog = () => {}

describe('autoApplyProviderIfNeeded — gating', () => {
  test('skips when explicit CLAUDE_CODE_USE_OPENAI is set', async () => {
    const env: NodeJS.ProcessEnv = {
      CLAUDE_CODE_USE_OPENAI: '1',
      OPENAI_API_KEY: 'sk-x',
    }
    const result = await autoApplyProviderIfNeeded({
      processEnv: env,
      hasProfileFile: () => false,
      detect: async () => {
        throw new Error('detect should not be called')
      },
      log: noLog,
    })
    expect(result.applied).toBe(false)
    if (!result.applied) {
      expect(result.reason).toContain('explicit')
    }
  })

  test('skips when a persisted profile file exists', async () => {
    const env: NodeJS.ProcessEnv = { OPENAI_API_KEY: 'sk-x' }
    const result = await autoApplyProviderIfNeeded({
      processEnv: env,
      hasProfileFile: () => true,
      detect: async () => {
        throw new Error('detect should not be called')
      },
      log: noLog,
    })
    expect(result.applied).toBe(false)
    if (!result.applied) {
      expect(result.reason).toContain('profile')
    }
    expect(env.CLAUDE_CODE_USE_OPENAI).toBeUndefined()
  })

  test('skips when nothing is detected', async () => {
    const env: NodeJS.ProcessEnv = {}
    const result = await autoApplyProviderIfNeeded({
      processEnv: env,
      hasProfileFile: () => false,
      detect: async () => null,
      log: noLog,
    })
    expect(result.applied).toBe(false)
    if (!result.applied) {
      expect(result.reason).toContain('no provider detected')
    }
  })
})

describe('autoApplyProviderIfNeeded — applies for env providers', () => {
  test('anthropic detected → no env changes, still applied=true', async () => {
    const env: NodeJS.ProcessEnv = { ANTHROPIC_API_KEY: 'sk-ant' }
    const logs: string[] = []
    const result = await autoApplyProviderIfNeeded({
      processEnv: env,
      hasProfileFile: () => false,
      detect: async () => ({
        kind: 'anthropic',
        source: 'ANTHROPIC_API_KEY set',
      }),
      log: m => logs.push(m),
    })
    expect(result.applied).toBe(true)
    if (result.applied) {
      expect(result.provider.kind).toBe('anthropic')
      expect(result.envChanges).toEqual({})
    }
    expect(env.CLAUDE_CODE_USE_OPENAI).toBeUndefined()
    expect(env.CLAUDE_CODE_USE_GEMINI).toBeUndefined()
    expect(logs.length).toBe(1)
    expect(logs[0]).toContain('anthropic')
  })

  test('openai detected → sets CLAUDE_CODE_USE_OPENAI', async () => {
    const env: NodeJS.ProcessEnv = { OPENAI_API_KEY: 'sk-x' }
    const result = await autoApplyProviderIfNeeded({
      processEnv: env,
      hasProfileFile: () => false,
      detect: async () => ({ kind: 'openai', source: 'OPENAI_API_KEY set' }),
      log: noLog,
    })
    expect(result.applied).toBe(true)
    expect(env.CLAUDE_CODE_USE_OPENAI).toBe('1')
  })

  test('gemini detected → sets CLAUDE_CODE_USE_GEMINI', async () => {
    const env: NodeJS.ProcessEnv = { GEMINI_API_KEY: 'gem-x' }
    const result = await autoApplyProviderIfNeeded({
      processEnv: env,
      hasProfileFile: () => false,
      detect: async () => ({ kind: 'gemini', source: 'GEMINI_API_KEY set' }),
      log: noLog,
    })
    expect(result.applied).toBe(true)
    expect(env.CLAUDE_CODE_USE_GEMINI).toBe('1')
  })

  test('github detected → sets CLAUDE_CODE_USE_GITHUB', async () => {
    const env: NodeJS.ProcessEnv = { GITHUB_TOKEN: 'ghp-x' }
    const result = await autoApplyProviderIfNeeded({
      processEnv: env,
      hasProfileFile: () => false,
      detect: async () => ({
        kind: 'github',
        source: 'GITHUB_TOKEN set (GitHub Copilot)',
      }),
      log: noLog,
    })
    expect(result.applied).toBe(true)
    expect(env.CLAUDE_CODE_USE_GITHUB).toBe('1')
  })

  test('mistral detected → sets CLAUDE_CODE_USE_MISTRAL', async () => {
    const env: NodeJS.ProcessEnv = { MISTRAL_API_KEY: 'mis-x' }
    const result = await autoApplyProviderIfNeeded({
      processEnv: env,
      hasProfileFile: () => false,
      detect: async () => ({ kind: 'mistral', source: 'MISTRAL_API_KEY set' }),
      log: noLog,
    })
    expect(result.applied).toBe(true)
    expect(env.CLAUDE_CODE_USE_MISTRAL).toBe('1')
  })
})

describe('autoApplyProviderIfNeeded — deferred providers', () => {
  test('codex detected → NOT applied (deferred to picker)', async () => {
    const env: NodeJS.ProcessEnv = { CODEX_API_KEY: 'codex-x' }
    const result = await autoApplyProviderIfNeeded({
      processEnv: env,
      hasProfileFile: () => false,
      detect: async () => ({ kind: 'codex', source: 'CODEX_API_KEY set' }),
      log: noLog,
    })
    expect(result.applied).toBe(false)
    if (!result.applied) {
      expect(result.reason).toContain('deferred to picker')
      expect(result.provider?.kind).toBe('codex')
    }
    expect(env.CLAUDE_CODE_USE_OPENAI).toBeUndefined()
  })

  test('ollama detected → NOT applied (needs model selection)', async () => {
    const env: NodeJS.ProcessEnv = {}
    const result = await autoApplyProviderIfNeeded({
      processEnv: env,
      hasProfileFile: () => false,
      detect: async () => ({
        kind: 'ollama',
        source: 'Ollama reachable at http://localhost:11434',
        baseUrl: 'http://localhost:11434',
      }),
      log: noLog,
    })
    expect(result.applied).toBe(false)
    if (!result.applied) {
      expect(result.reason).toContain('deferred')
    }
    expect(env.CLAUDE_CODE_USE_OPENAI).toBeUndefined()
  })

  test('lm-studio detected → NOT applied (needs model selection)', async () => {
    const env: NodeJS.ProcessEnv = {}
    const result = await autoApplyProviderIfNeeded({
      processEnv: env,
      hasProfileFile: () => false,
      detect: async () => ({
        kind: 'lm-studio',
        source: 'LM Studio reachable',
        baseUrl: 'http://localhost:1234',
      }),
      log: noLog,
    })
    expect(result.applied).toBe(false)
    expect(env.CLAUDE_CODE_USE_OPENAI).toBeUndefined()
  })

  test('minimax detected → NOT applied (existing flow handles MINIMAX_API_KEY)', async () => {
    const env: NodeJS.ProcessEnv = { MINIMAX_API_KEY: 'mm-x' }
    const result = await autoApplyProviderIfNeeded({
      processEnv: env,
      hasProfileFile: () => false,
      detect: async () => ({ kind: 'minimax', source: 'MINIMAX_API_KEY set' }),
      log: noLog,
    })
    expect(result.applied).toBe(false)
  })
})

describe('autoApplyProviderIfNeeded — side effects', () => {
  test('does not mutate env when detection is skipped', async () => {
    const env: NodeJS.ProcessEnv = {
      CLAUDE_CODE_USE_OPENAI: '1',
      OPENAI_API_KEY: 'sk-x',
    }
    const snapshot = { ...env }
    await autoApplyProviderIfNeeded({
      processEnv: env,
      hasProfileFile: () => false,
      detect: async () => {
        throw new Error('unreachable')
      },
      log: noLog,
    })
    expect(env).toEqual(snapshot)
  })

  test('does not mutate other env keys beyond the apply map', async () => {
    const env: NodeJS.ProcessEnv = {
      OPENAI_API_KEY: 'sk-x',
      PATH: '/usr/bin:/bin',
      HOME: '/Users/test',
    }
    await autoApplyProviderIfNeeded({
      processEnv: env,
      hasProfileFile: () => false,
      detect: async () => ({ kind: 'openai', source: 'OPENAI_API_KEY set' }),
      log: noLog,
    })
    expect(env.PATH).toBe('/usr/bin:/bin')
    expect(env.HOME).toBe('/Users/test')
    expect(env.OPENAI_API_KEY).toBe('sk-x')
    expect(env.CLAUDE_CODE_USE_OPENAI).toBe('1')
  })

  test('log message includes env changes applied', async () => {
    const env: NodeJS.ProcessEnv = { OPENAI_API_KEY: 'sk-x' }
    const logs: string[] = []
    await autoApplyProviderIfNeeded({
      processEnv: env,
      hasProfileFile: () => false,
      detect: async () => ({ kind: 'openai', source: 'OPENAI_API_KEY set' }),
      log: m => logs.push(m),
    })
    expect(logs.length).toBe(1)
    expect(logs[0]).toContain('CLAUDE_CODE_USE_OPENAI=1')
  })
})
