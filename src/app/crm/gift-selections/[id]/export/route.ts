import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/lib/auth'
import { isGiftStaffRole } from '@/lib/roles'
import { isUuid } from '@/lib/utils'
import { giftRowsToCsv, giftRowsToExcel, type GiftExportRow } from '@/lib/gifts/export'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!isUuid(id)) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const profile = await getProfile()
  if (!profile || !isGiftStaffRole(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('gift_selection_submissions')
    .select('employee_name, employee_email, selected_label, size, address, city, state, pin, phone')
    .eq('selection_id', id)
    .order('employee_name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows: GiftExportRow[] = (data || []).map((row) => ({
    employeeName: row.employee_name,
    email: row.employee_email,
    selectedProduct: row.selected_label,
    variant: row.size || '',
    address: row.address,
    city: row.city,
    state: row.state,
    pin: row.pin,
    phone: row.phone,
  }))
  const format = new URL(request.url).searchParams.get('format')
  if (format === 'xls') {
    return new NextResponse(giftRowsToExcel(rows), {
      headers: {
        'Content-Type': 'application/vnd.ms-excel; charset=utf-8',
        'Content-Disposition': 'attachment; filename="gift-selection.xls"',
        'Cache-Control': 'no-store',
      },
    })
  }
  return new NextResponse(giftRowsToCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="gift-selection.csv"',
      'Cache-Control': 'no-store',
    },
  })
}
