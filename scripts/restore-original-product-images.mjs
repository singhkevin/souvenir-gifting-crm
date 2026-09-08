/**
 * Restore original Supabase image URLs (undo over-aggressive catalogue-fill crops).
 * Does NOT commit. Local review only.
 */
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv(filePath) {
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 0) continue
    const key = line.slice(0, i).trim()
    let value = line.slice(i + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnv('.env')
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const originals = JSON.parse(fs.readFileSync('tmp/products-for-crop.json', 'utf8'))
let ok = 0
let fail = 0
let skipped = 0

for (const product of originals) {
  const url = product.image_url
  if (!url || String(url).startsWith('/')) {
    skipped += 1
    continue
  }
  const { error } = await admin.from('products').update({ image_url: url }).eq('id', product.id)
  if (error) {
    fail += 1
    console.error('fail', product.name, error.message)
  } else {
    ok += 1
  }
}

console.log(JSON.stringify({ ok, fail, skipped }))
