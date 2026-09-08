import fs from 'fs'
import sharp from 'sharp'
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

const SIZE = 1200
const RATIO = 0.62
const BG = { r: 232, g: 222, b: 208, alpha: 1 }
const names = [
  'Achievement medal with ribbon',
  'Silver cup trophy',
  'Obelisk crystal tower',
  'Crystal recognition plaque',
  'Glass globe trophy',
  'Rolled wellness yoga mat',
]

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data, error } = await admin.from('products').select('id, name, image_url').in('name', names)
if (error) throw error

for (const product of data || []) {
  const local = `tmp/studio-reframe/${product.id}.webp`
  let buf
  if (fs.existsSync(local)) buf = fs.readFileSync(local)
  else {
    const res = await fetch(product.image_url)
    buf = Buffer.from(await res.arrayBuffer())
  }
  const productImg = await sharp(buf)
    .resize(Math.round(SIZE * RATIO), Math.round(SIZE * RATIO), { fit: 'inside', background: BG })
    .png()
    .toBuffer()
  const meta = await sharp(productImg).metadata()
  const pw = meta.width || 1
  const ph = meta.height || 1
  const left = Math.round((SIZE - pw) / 2)
  const top = Math.round((SIZE - ph) / 2)
  const out = await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: BG } })
    .composite([{ input: productImg, left, top }])
    .webp({ quality: 88 })
    .toBuffer()
  const objectPath = `${product.id}/studio-pack-${Date.now()}.webp`
  const { error: upErr } = await admin.storage
    .from('product-images')
    .upload(objectPath, out, { contentType: 'image/webp', upsert: true })
  if (upErr) throw upErr
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/product-images/${objectPath}`
  await admin.from('products').update({ image_url: url }).eq('id', product.id)
  fs.writeFileSync(local, out)
  console.log('ok', product.name)
}
