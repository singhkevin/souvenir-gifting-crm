import { NextRequest, NextResponse } from 'next/server'
import { hasRecoveryQuery } from '@/lib/auth/recovery'

export async function GET(request: NextRequest) {
  const incoming = request.nextUrl
  const dest = hasRecoveryQuery(incoming.searchParams) ? '/auth/confirm' : '/login'
  const target = new URL(dest, incoming.origin)
  incoming.searchParams.forEach((value, key) => {
    target.searchParams.set(key, value)
  })
  return NextResponse.redirect(target)
}
