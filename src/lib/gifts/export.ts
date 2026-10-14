export const GIFT_EXPORT_HEADERS = [
  'Employee Name',
  'Email',
  'Selected Product',
  'Variant/Size',
  'Address',
  'City',
  'State',
  'PIN',
  'Phone',
] as const

export type GiftExportRow = {
  employeeName: string
  email: string
  selectedProduct: string
  variant: string
  address: string
  city: string
  state: string
  pin: string
  phone: string
}

function cells(row: GiftExportRow): string[] {
  return [
    row.employeeName,
    row.email,
    row.selectedProduct,
    row.variant,
    row.address,
    row.city,
    row.state,
    row.pin,
    row.phone,
  ]
}

function csvCell(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

export function giftRowsToCsv(rows: GiftExportRow[]): string {
  const lines = [GIFT_EXPORT_HEADERS.join(',')]
  for (const row of rows) lines.push(cells(row).map(csvCell).join(','))
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

function xml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function giftRowsToExcel(rows: GiftExportRow[]): string {
  const header = GIFT_EXPORT_HEADERS.map(
    (label) => `<Cell><Data ss:Type="String">${xml(label)}</Data></Cell>`,
  ).join('')
  const body = rows
    .map((row) => {
      const cols = cells(row)
        .map((value) => `<Cell><Data ss:Type="String">${xml(value)}</Data></Cell>`)
        .join('')
      return `<Row>${cols}</Row>`
    })
    .join('')
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Gift choices">
<Table>
<Row>${header}</Row>
${body}
</Table>
</Worksheet>
</Workbook>`
}

export type GiftCount = { label: string; size: string; count: number }

export function countGiftChoices(
  rows: { label: string; size: string | null }[],
): GiftCount[] {
  const map = new Map<string, GiftCount>()
  for (const row of rows) {
    const size = row.size?.trim() || '—'
    const key = `${row.label}\0${size}`
    const current = map.get(key)
    if (current) current.count += 1
    else map.set(key, { label: row.label, size, count: 1 })
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}
