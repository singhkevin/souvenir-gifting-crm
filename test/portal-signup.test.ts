import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  canDecidePortalSignup,
  initialPortalApproval,
  parsePortalSignupMode,
  portalDecisionPatch,
  portalSignupDomainRefusal,
  portalSignupRefusal,
  staffPortalEmailProblem,
} from '../src/lib/portal/signup.ts'

const migration = readFileSync(
  new URL('../supabase/migrations/20261031_portal_self_signup.sql', import.meta.url),
  'utf8',
)
const rollback = readFileSync(
  new URL('../supabase/rollbacks/20261031_portal_self_signup_rollback.sql', import.meta.url),
  'utf8',
)

test('manual is the default and self sign-up stays pending until email confirmation', () => {
  assert.equal(parsePortalSignupMode('', 'manual'), 'manual')
  assert.equal(initialPortalApproval({
    mode: 'manual',
    source: 'self',
    emailConfirmed: true,
    domainAllowed: true,
  }), 'pending')
  assert.equal(initialPortalApproval({
    mode: 'auto_domain',
    source: 'self',
    emailConfirmed: false,
    domainAllowed: true,
  }), 'pending')
  assert.equal(initialPortalApproval({
    mode: 'auto_domain',
    source: 'self',
    emailConfirmed: true,
    domainAllowed: true,
  }), 'approved')
  assert.equal(initialPortalApproval({
    mode: 'auto_all',
    source: 'invite',
    emailConfirmed: true,
    domainAllowed: true,
  }), 'approved')
  assert.equal(initialPortalApproval({
    mode: 'manual',
    source: 'staff',
    emailConfirmed: true,
    domainAllowed: true,
  }), 'pending')
  assert.equal(initialPortalApproval({
    mode: 'off',
    source: 'staff',
    emailConfirmed: true,
    domainAllowed: false,
  }), 'approved')
  assert.equal(initialPortalApproval({
    mode: 'auto_domain',
    source: 'invite',
    emailConfirmed: true,
    domainAllowed: true,
  }), 'pending')
})

test('self sign-up refuses other domains, an empty list, and free inboxes unless the company lists them', () => {
  assert.match(portalSignupDomainRefusal('ada@gmail.com', ['acme.com']) || '', /Free email/)
  assert.equal(portalSignupDomainRefusal('ada@gmail.com', ['gmail.com', 'acme.com']), null)
  assert.match(portalSignupDomainRefusal('ada@other.com', ['acme.com']) || '', /acme.com/)
  assert.match(portalSignupDomainRefusal('ada@acme.com', []) || '', /not listed/)
  assert.equal(portalSignupDomainRefusal('ada@acme.com', ['acme.com']), null)
  assert.match(staffPortalEmailProblem('ada@gmail.com', [], false) || '', /Free email/)
  assert.equal(staffPortalEmailProblem('ada@gmail.com', [], true), null)
  assert.equal(staffPortalEmailProblem('ada@gmail.com', ['gmail.com'], false), null)
  assert.match(staffPortalEmailProblem('ada@other.com', ['acme.com'], false) || '', /allowed domain/)
})

test('suspended, expired trial, direct, and business hosts cannot self-register', () => {
  assert.match(portalSignupRefusal({
    accountType: 'corporate',
    portalStatus: 'suspended',
    trialEndsAt: null,
    mode: 'manual',
  }) || '', /suspended/)
  assert.match(portalSignupRefusal({
    accountType: 'corporate',
    portalStatus: 'trial',
    trialEndsAt: '2020-01-01T00:00:00.000Z',
    mode: 'manual',
    now: Date.parse('2026-01-01T00:00:00.000Z'),
  }) || '', /trial has ended/)
  assert.equal(portalSignupRefusal({
    accountType: 'corporate',
    portalStatus: 'trial',
    trialEndsAt: '2027-01-01T00:00:00.000Z',
    mode: 'manual',
    now: Date.parse('2026-01-01T00:00:00.000Z'),
  }), null)
  assert.match(portalSignupRefusal({
    accountType: 'direct',
    portalStatus: 'active',
    trialEndsAt: null,
    mode: 'manual',
  }) || '', /no company portal/)
  assert.match(portalSignupRefusal({
    accountType: 'business',
    portalStatus: 'active',
    trialEndsAt: null,
    mode: 'manual',
  }) || '', /business portal/)
  assert.match(portalSignupRefusal({
    accountType: 'corporate',
    portalStatus: 'active',
    trialEndsAt: null,
    mode: 'off',
  }) || '', /turned off/)
})

test('a user cannot self-approve, change company, or escalate role', () => {
  const base = {
    actorId: 'actor',
    actorRole: 'client_admin',
    actorCompanyId: 'acme',
    actorApproval: 'approved',
    targetId: 'person',
    targetRole: 'client_user',
    targetCompanyId: 'acme',
  }
  assert.equal(canDecidePortalSignup({ ...base, actorId: 'person', targetId: 'person' }).ok, false)
  assert.equal(canDecidePortalSignup({ ...base, actorRole: 'client_user' }).ok, false)
  assert.equal(canDecidePortalSignup({ ...base, actorCompanyId: 'other' }).ok, false)
  assert.equal(canDecidePortalSignup({ ...base, actorApproval: 'pending' }).ok, false)
  assert.equal(canDecidePortalSignup({ ...base, targetRole: 'admin' }).ok, false)
  assert.equal(canDecidePortalSignup(base).ok, true)
  assert.equal(canDecidePortalSignup({ ...base, actorRole: 'sales', actorCompanyId: null }).ok, true)
  assert.equal(canDecidePortalSignup({ ...base, actorRole: 'admin', actorCompanyId: null }).ok, true)
  assert.equal(canDecidePortalSignup({ ...base, actorRole: 'operations' }).ok, false)

  const patch = portalDecisionPatch({ decision: 'approved', actorId: 'actor', now: '2026-10-31T00:00:00.000Z' })
  assert.deepEqual(Object.keys(patch).sort(), ['portal_approval', 'portal_approved_at', 'portal_approved_by'])
  assert.equal('role' in patch, false)
  assert.equal('company_id' in patch, false)
})

test('the database guard refuses a caller changing their own role, company, or approval', () => {
  assert.match(migration, /begin;/)
  assert.match(migration, /commit;/)
  assert.match(migration, /old\.id is distinct from auth\.uid\(\)/)
  assert.match(migration, /You cannot change this account role, company, or approval/)
  assert.match(migration, /service_role/)
  assert.match(migration, /portal_domain_exception/)
  assert.match(migration, /create or replace function public\.portal_access\(\)/)
  assert.match(migration, /public\.portal_access\(\) = 'approved'/)
  assert.match(migration, /raw_app_meta_data->>'portal_approval'/)
  assert.doesNotMatch(migration, /raw_user_meta_data->>'role'/)
  assert.doesNotMatch(migration, /raw_user_meta_data->>'company_id'/)
  assert.match(rollback, /drop function if exists public\.guard_portal_profile\(\)/)
  assert.match(rollback, /drop column if exists portal_approval/)
})
