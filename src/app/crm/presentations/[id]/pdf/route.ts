import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { getProfile } from '@/lib/auth'
import { isPresentationStaffRole } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import { isUuid } from '@/lib/utils'
import { buildPresentationPdf } from '@/lib/presentations/pdf'
import { publicDeckContact } from '@/lib/presentations/contact'

async function slideImage(url: string | null) {
  if (!url) return null
  if (url.startsWith('/')) {
    const root = path.join(process.cwd(), 'public')
    const file = path.normalize(path.join(root, url))
    if (!file.startsWith(root)) return null
    try {
      return new Uint8Array(await readFile(file))
    } catch {
      return null
    }
  }
  try {
    const host = new URL(url).hostname
    if (!host.endsWith('.supabase.co')) return null
    const response = await fetch(url)
    if (!response.ok) return null
    return new Uint8Array(await response.arrayBuffer())
  } catch {
    return null
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const profile = await getProfile()
  if (!profile || !profile.is_active || !isPresentationStaffRole(profile.role)) {
    return new NextResponse('Not found', { status: 404 })
  }
  const { id } = await context.params
  if (!isUuid(id)) return new NextResponse('Not found', { status: 404 })
  const supabase = await createClient()
  const [{ data: deck }, { data: items }, contact] = await Promise.all([
    supabase.from('presentations').select('title, client_name, notes, show_prices').eq('id', id).maybeSingle(),
    supabase.from('presentation_items').select('title, image_url, specs, price, moq, kind, member_names, sort_order').eq('presentation_id', id).order('sort_order'),
    publicDeckContact(),
  ])
  if (!deck) return new NextResponse('Not found', { status: 404 })
  const slides = []
  for (const item of items || []) {
    slides.push({
      title: item.title,
      specs: item.specs || '',
      price: Number(item.price),
      moq: item.moq,
      kind: item.kind as 'product' | 'combo',
      memberNames: item.member_names || [],
      image: await slideImage(item.image_url),
    })
  }
  const pdf = await buildPresentationPdf({
    title: deck.title,
    clientName: deck.client_name,
    notes: deck.notes || '',
    organisation: contact.organisation,
    phone: contact.phone,
    showPrices: deck.show_prices !== false,
    slides,
  })
  const filename = `${deck.title.replace(/[^\w.-]+/g, '-').slice(0, 40) || 'presentation'}.pdf`
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
