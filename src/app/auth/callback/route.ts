import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const incoming = request.nextUrl
  const type = incoming.searchParams.get('type')
  const dest =
    type === 'recovery' || incoming.searchParams.has('token_hash')
      ? '/reset-password'
      : incoming.searchParams.has('code') && type !== 'signup'
        ? '/reset-password'
        : '/login'
  const target = new URL(dest, incoming.origin)
  incoming.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value)
  })
  return NextResponse.redirect(target)
}
