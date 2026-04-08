import { expect, test } from 'bun:test'

import { getSystemContext, getUserContext } from './context.ts'

// Regression: currentDate must live in system context (which is appended
// after SYSTEM_PROMPT_DYNAMIC_BOUNDARY in the system prompt blocks), NOT in
// user context. User context is injected as a user message at index 0 of
// the cached message-history region — putting currentDate there would bust
// the message cache every day at midnight.
test('currentDate is in system context, not user context', async () => {
  const [systemContext, userContext] = await Promise.all([
    getSystemContext(),
    getUserContext(),
  ])

  expect(systemContext.currentDate).toBeDefined()
  expect(systemContext.currentDate).toMatch(/Today's date is \d{4}-\d{2}-\d{2}\./)
  expect(userContext.currentDate).toBeUndefined()
})
