import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('missing supabase env')
  process.exit(1)
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const updates = JSON.parse(fs.readFileSync('tmp/catalogue-fill-updates.json', 'utf8'))
const skip = new Set([
  'd957fdd1-dd5b-4d13-8052-f7c2a5c85370',
  'd1000000-0000-4000-8000-00000000000f',
  '6d4901c1-a107-4368-aaf0-58c168eaeb43',
  '17a085da-27ae-4ef5-8446-19a0996c54ae',
  'fb495145-c1de-4a34-b70f-e45053fe6cf6',
  // Branded golf towel: crop trims the carabiner clip that identifies the product.
  'a3d5a95e-e417-4ece-8028-575c5b9778c2',
])

const rows = updates.filter((u) => !skip.has(u.id) && fs.existsSync(`public/catalogue-fill/${u.id}.webp`))
let ok = 0
let fail = 0
for (const row of rows) {
  const { error } = await admin.from('products').update({ image_url: row.path }).eq('id', row.id)
  if (error) {
    fail += 1
    console.error('fail', row.name, error.message)
  } else {
    ok += 1
  }
}

// Ensure featured local assets stay pinned
const pins = [
  { name: 'Premium induction gift box', image_url: '/site/home-welcome-kit.webp' },
  { name: 'New joiner onboarding hamper', image_url: '/site/home-new-joiner.webp' },
  { name: 'Leadership recognition hamper', image_url: '/site/home-client-appreciation.webp' },
  { name: 'Festival hamper crate', image_url: '/site/home-festival-crate.webp' },
  { name: 'Festive corporate hamper crate', image_url: '/site/home-festive-cane.webp' },
]
for (const pin of pins) {
  const { error } = await admin.from('products').update({ image_url: pin.image_url }).eq('name', pin.name)
  if (error) console.error('pin fail', pin.name, error.message)
}

console.log(JSON.stringify({ ok, fail, pins: pins.length }))
