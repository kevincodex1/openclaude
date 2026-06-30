import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import type { StatusNoticeContext } from './statusNoticeDefinitions.js'
import { statusNoticeDefinitions } from './statusNoticeDefinitions.js'
import { saveGlobalConfig } from './config.js'
import { renderToString } from './staticRender.js'

// Coverage for the "update available" startup notice: it should appear below
// the logo only when a newer version exists AND the user must update manually
// (auto-update disabled, or the last auto-update attempt failed).

const notice = statusNoticeDefinitions.find(n => n.id === 'update-available')

function buildContext(
  configOverrides?: Partial<StatusNoticeContext['config']>,
): StatusNoticeContext {
  return {
    config: { ...configOverrides } as StatusNoticeContext['config'],
    memoryFiles: [],
  }
}

const SAVED_MACRO = (globalThis as Record<string, unknown>).MACRO
const SAVED_DISABLE = process.env.DISABLE_AUTOUPDATER

beforeAll(() => {
  // MACRO is replaced at build time by Bun.define but not in test mode, so set
  // a realistic published-build shape here.
  ;(globalThis as Record<string, unknown>).MACRO = {
    VERSION: '0.20.1',
    DISPLAY_VERSION: '0.20.1',
    PACKAGE_URL: '@gitlawb/openclaude',
  }
})

afterEach(() => {
  delete process.env.DISABLE_AUTOUPDATER
  // The shared test config defaults autoUpdates to false (= disabled); reset it
  // so a test that enables auto-updates can't leak into the next one.
  saveGlobalConfig(current => ({ ...current, autoUpdates: false }))
})

afterAll(() => {
  if (SAVED_MACRO === undefined) {
    delete (globalThis as Record<string, unknown>).MACRO
  } else {
    ;(globalThis as Record<string, unknown>).MACRO = SAVED_MACRO
  }
  if (SAVED_DISABLE === undefined) {
    delete process.env.DISABLE_AUTOUPDATER
  } else {
    process.env.DISABLE_AUTOUPDATER = SAVED_DISABLE
  }
})

describe('update-available notice', () => {
  test('is registered first so it renders directly under the logo', () => {
    expect(notice).toBeDefined()
    expect(statusNoticeDefinitions[0]?.id).toBe('update-available')
  })

  test('hidden when no version has been cached yet', () => {
    process.env.DISABLE_AUTOUPDATER = '1'
    expect(notice!.isActive(buildContext())).toBe(false)
  })

  test('hidden when the cached latest is not newer than the running version', () => {
    process.env.DISABLE_AUTOUPDATER = '1'
    expect(
      notice!.isActive(buildContext({ lastKnownLatestVersion: '0.20.1' })),
    ).toBe(false)
    expect(
      notice!.isActive(buildContext({ lastKnownLatestVersion: '0.19.0' })),
    ).toBe(false)
  })

  test('hidden when newer exists but auto-update is healthy (enabled, no failure)', () => {
    // Enable auto-updates and leave autoUpdateFailed unset → the footer handles
    // it, so the prominent box stays hidden.
    saveGlobalConfig(current => ({ ...current, autoUpdates: true }))
    expect(
      notice!.isActive(buildContext({ lastKnownLatestVersion: '0.21.0' })),
    ).toBe(false)
  })

  test('shown when newer exists and auto-update is disabled', () => {
    process.env.DISABLE_AUTOUPDATER = '1'
    expect(
      notice!.isActive(buildContext({ lastKnownLatestVersion: '0.21.0' })),
    ).toBe(true)
  })

  test('shown when newer exists and the last auto-update attempt failed', () => {
    // Enable auto-updates so the failure flag — not the disabled state — is
    // what surfaces the notice.
    saveGlobalConfig(current => ({ ...current, autoUpdates: true }))
    expect(
      notice!.isActive(
        buildContext({
          lastKnownLatestVersion: '0.21.0',
          autoUpdateFailed: true,
        }),
      ),
    ).toBe(true)
  })

  test('renders the version transition, update command, and release notes link', async () => {
    const text = await renderToString(
      notice!.render(buildContext({ lastKnownLatestVersion: '0.21.0' })),
      80,
    )
    expect(text).toContain('Update available!')
    expect(text).toContain('0.20.1')
    expect(text).toContain('0.21.0')
    expect(text).toContain('npm install -g @gitlawb/openclaude@latest')
    expect(text).toContain('https://github.com/Gitlawb/openclaude/releases/latest')
  })

  test('uses the local update command for local installs', async () => {
    const text = await renderToString(
      notice!.render(
        buildContext({
          lastKnownLatestVersion: '0.21.0',
          installMethod: 'local',
        }),
      ),
      80,
    )
    expect(text).toContain('npm update @gitlawb/openclaude')
    expect(text).not.toContain('npm install -g')
  })
})
