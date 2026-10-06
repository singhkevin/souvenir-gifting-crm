export type CsvTable = {
  headers: string[]
  rows: string[][]
}

function pushCell(row: string[], current: string, inQuotes: boolean) {
  row.push(inQuotes ? current : current.trim())
}

/** RFC4180-style CSV parser. Does not execute formulas or fetch remote URLs. */
export function parseCsv(text: string): CsvTable {
  const input = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
      pushCell(row, current, false)
      current = ''
      continue
    }
    if (ch === '\n') {
      pushCell(row, current, false)
      if (row.some((cell) => cell.length > 0)) rows.push(row)
      row = []
      current = ''
      continue
    }
    if (ch === '\r') continue
    current += ch
  }
  if (current.length > 0 || row.length > 0) {
    pushCell(row, current, false)
    if (row.some((cell) => cell.length > 0)) rows.push(row)
  }

  if (rows.length === 0) return { headers: [], rows: [] }
  const headers = rows[0].map((h) => h.trim())
  return { headers, rows: rows.slice(1) }
}

export function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

export const CSV_FIELD_ALIASES: Record<string, string[]> = {
  name: ['name', 'product_name', 'product', 'title'],
  sku: ['sku', 'product_code', 'code', 'item_code'],
  description: ['description', 'desc', 'notes', 'details'],
  category: ['category', 'category_name'],
  supplier: ['supplier', 'supplier_name', 'vendor'],
  price: ['price', 'selling_price', 'unit_price', 'mrp'],
  supplier_cost: ['supplier_cost', 'cost', 'landed_cost'],
  moq: ['moq', 'min_qty', 'minimum_order_qty', 'quantity'],
  stock_qty: ['stock_qty', 'stock', 'on_hand', 'quantity_on_hand'],
  fulfillment_mode: ['fulfillment_mode', 'purchase_path', 'buy_or_rfq'],
  hsn_code: ['hsn_code', 'hsn'],
  image_url: ['image_url', 'image', 'photo_url', 'picture_url'],
  image_filename: ['image_filename', 'image_file', 'filename', 'photo_filename'],
  catalogue_access: ['catalogue_access', 'visibility', 'access'],
  companies: ['companies', 'company', 'clients', 'client'],
  colour: ['colour', 'color', 'variant_colour'],
  size: ['size', 'variant_size'],
  gender: ['gender'],
  material: ['material'],
  variant_sku: ['variant_sku'],
  extra_price: ['extra_price', 'variant_price'],
  status: ['status'],
}

export function autoMapHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  const normalized = headers.map((h) => ({ raw: h, key: normalizeHeader(h) }))
  for (const [field, aliases] of Object.entries(CSV_FIELD_ALIASES)) {
    const match = normalized.find((h) => aliases.includes(h.key))
    if (match) mapping[field] = match.raw
  }
  return mapping
}

export function splitCompanyNames(value: string) {
  return value
    .split(/[;|]/)
    .map((part) => part.trim())
    .filter(Boolean)
}
