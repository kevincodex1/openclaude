/**
 * Zero-config provider autodetection — application layer.
 *
 * Glues the pure detection primitive (providerAutoDetect.ts) into the
 * startup flow: when the user has NOT explicitly selected a provider and
 * has NO persisted /provider profile, detect the best match from ambient
 * credentials/local services and apply just enough env to make that
 * provider active.
 *
 * Only env-var-based providers are applied in v1 (anthropic is default,
 * openai/gemini/github/mistral need a single CLAUDE_CODE_USE_* flip).
 * Providers that require model selection (codex, ollama, lm-studio) are
 * deferred to the existing provider-picker flow.
 */

import {
  detectBestProvider,
  type DetectedProvider,
} from './providerAutoDetect.js'
import {
  hasExplicitProviderSelection,
  loadProfileFile,
} from './providerProfile.js'

export type AutoApplyResult =
  | { applied: true; provider: DetectedProvider; envChanges: Record<string, string> }
  | { applied: false; reason: string; provider?: DetectedProvider }

/**
 * Providers whose active state is fully determined by env credentials
 * already present, needing at most a single CLAUDE_CODE_USE_* flip.
 * Providers not in this list require extra setup (model picker, OAuth
 * flow, local-service model selection) and are deferred to the existing
 * onboarding path.
 */
const AUTO_APPLY_PROVIDERS: Record<string, Record<string, string> | null> = {
  anthropic: {}, // first-party — no env changes; default behavior
  openai: { CLAUDE_CODE_USE_OPENAI: '1' },
  gemini: { CLAUDE_CODE_USE_GEMINI: '1' },
  github: { CLAUDE_CODE_USE_GITHUB: '1' },
  mistral: { CLAUDE_CODE_USE_MISTRAL: '1' },
  // Deferred to picker flow (explicit nulls, not missing keys, to make
  // the omission intentional and grep-able):
  codex: null,
  minimax: null,
  ollama: null,
  'lm-studio': null,
}

export type AutoApplyOptions = {
  processEnv?: NodeJS.ProcessEnv
  /** Override detection — primarily for tests. */
  detect?: () => Promise<DetectedProvider | null>
  /** Override profile-file probing — primarily for tests. */
  hasProfileFile?: () => boolean
  /** Log sink. Defaults to console.error. Pass () => {} to silence. */
  log?: (message: string) => void
}

/**
 * Run provider autodetection and apply the result to the given env.
 * Idempotent: returns `{ applied: false }` if an explicit selection exists
 * or a profile file is already persisted. Does NOT mutate env when a
 * provider is detected but not in the auto-applyable set — those defer
 * to the picker.
 */
export async function autoApplyProviderIfNeeded(
  options?: AutoApplyOptions,
): Promise<AutoApplyResult> {
  const env = options?.processEnv ?? process.env
  const log = options?.log ?? (message => console.error(message))

  if (hasExplicitProviderSelection(env)) {
    return {
      applied: false,
      reason: 'explicit provider selection present in env',
    }
  }

  const hasProfile = options?.hasProfileFile
    ? options.hasProfileFile()
    : loadProfileFile() !== null
  if (hasProfile) {
    return { applied: false, reason: 'persisted /provider profile present' }
  }

  const detect = options?.detect ?? (() => detectBestProvider({ env }))
  const detected = await detect()
  if (!detected) {
    return { applied: false, reason: 'no provider detected' }
  }

  const applyMap = AUTO_APPLY_PROVIDERS[detected.kind]
  if (applyMap === null) {
    return {
      applied: false,
      reason: `${detected.kind} requires explicit setup (deferred to picker)`,
      provider: detected,
    }
  }
  if (applyMap === undefined) {
    return {
      applied: false,
      reason: `no auto-apply rule for provider kind "${detected.kind}"`,
      provider: detected,
    }
  }

  for (const [key, value] of Object.entries(applyMap)) {
    env[key] = value
  }

  const changesDescription =
    Object.keys(applyMap).length === 0
      ? '(no env changes needed)'
      : Object.entries(applyMap)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ')

  log(
    `[openclaude] auto-detected provider: ${detected.kind} — ${detected.source}. Applied: ${changesDescription}.`,
  )

  return { applied: true, provider: detected, envChanges: applyMap }
}
