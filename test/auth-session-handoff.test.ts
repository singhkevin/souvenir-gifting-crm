import assert from 'node:assert/strict'
import test from 'node:test'
import { isPublicAuthPath } from '../src/lib/auth/tab.ts'
import {
  isRecoveryAuthCookie,
  isRecoverySessionCookie,
  sessionCookieNameFromRecovery,
} from '../src/lib/auth/session-handoff.ts'
import { isTenantAuthPath } from '../src/lib/portal-host.ts'

const TAB = 'abcdef0123456789'

test('account confirmation can stay on the establish handoff', () => {
  assert.equal(isPublicAuthPath('/auth/establish'), true)
  assert.equal(isTenantAuthPath('/auth/establish'), true)
})

test('recovery session cookies rename onto the tab cookie', () => {
  assert.equal(sessionCookieNameFromRecovery('gf-auth-recovery', TAB), `gf-auth-${TAB}`)
  assert.equal(sessionCookieNameFromRecovery('gf-auth-recovery.0', TAB), `gf-auth-${TAB}.0`)
  assert.equal(sessionCookieNameFromRecovery('gf-auth-recovery.12', TAB), `gf-auth-${TAB}.12`)
  assert.equal(sessionCookieNameFromRecovery('gf-auth-recovery-code-verifier', TAB), null)
  assert.equal(sessionCookieNameFromRecovery('gf-auth-recovery', 'short'), null)
  assert.equal(isRecoverySessionCookie('gf-auth-recovery.0'), true)
  assert.equal(isRecoverySessionCookie('gf-auth-recovery-code-verifier'), false)
  assert.equal(isRecoveryAuthCookie('gf-auth-recovery-code-verifier'), true)
})
