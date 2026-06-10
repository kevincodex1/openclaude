// Stub — cachedMicrocompact not included in source snapshot (feature-gated).
// isCachedMicrocompactEnabled() returns false, so the cached-MC path in
// microCompact.ts/claude.ts never runs; these implementations only need to
// carry honest types and inert behavior.

/** A cache_edits content block sent to the API to delete cached tool results. */
export type CacheEditsBlock = {
  type: 'cache_edits'
  edits: { type: 'delete'; cache_reference: string }[]
}

/** A cache_edits block pinned to a user-message position for re-sending. */
export type PinnedCacheEdits = {
  userMessageIndex: number
  block: CacheEditsBlock
}

/** Mutable per-session cached-microcompact bookkeeping. */
export type CachedMCState = {
  /** tool_use IDs registered from tool_result blocks, in encounter order */
  registeredTools: Set<string>
  /** Registration order of tool_use IDs */
  toolOrder: string[]
  /** cache_references already deleted via cache_edits */
  deletedRefs: Set<string>
  /** Previously-inserted cache_edits blocks, re-sent at original positions */
  pinnedEdits: PinnedCacheEdits[]
}

export type CachedMCConfig = {
  enabled: boolean
  /** Number of compactable tool results that triggers a cache edit */
  triggerThreshold: number
  /** Number of most-recent tool results always kept */
  keepRecent: number
  /** Model-name substrings that support cache editing */
  supportedModels: string[]
  /** Whether the system prompt should suggest summarizing tool results */
  systemPromptSuggestSummaries: boolean
}

const INERT_CONFIG: CachedMCConfig = {
  enabled: false,
  triggerThreshold: 0,
  keepRecent: 0,
  supportedModels: [],
  systemPromptSuggestSummaries: false,
}

export function isCachedMicrocompactEnabled(): boolean {
  return false
}

export function isModelSupportedForCacheEditing(_model: string): boolean {
  return false
}

export function getCachedMCConfig(): CachedMCConfig {
  return INERT_CONFIG
}

export function createCachedMCState(): CachedMCState {
  return {
    registeredTools: new Set(),
    toolOrder: [],
    deletedRefs: new Set(),
    pinnedEdits: [],
  }
}

export function resetCachedMCState(state: CachedMCState): void {
  state.registeredTools.clear()
  state.toolOrder.length = 0
  state.deletedRefs.clear()
  state.pinnedEdits.length = 0
}

/** Marks all registered tools as sent to the API. No-op in this snapshot. */
export function markToolsSentToAPI(_state: CachedMCState): void {}

/** Register a tool_result for deletion tracking. No-op in this snapshot. */
export function registerToolResult(
  _state: CachedMCState,
  _toolUseId: string,
): void {}

/** Register a user message's group of tool results. No-op in this snapshot. */
export function registerToolMessage(
  _state: CachedMCState,
  _groupIds: string[],
): void {}

/** Tool_use IDs eligible for cache deletion. Always empty here. */
export function getToolResultsToDelete(_state: CachedMCState): string[] {
  return []
}

/** Build a cache_edits block for the given deletions. Always null here. */
export function createCacheEditsBlock(
  _state: CachedMCState,
  _toolsToDelete: string[],
): CacheEditsBlock | null {
  return null
}
