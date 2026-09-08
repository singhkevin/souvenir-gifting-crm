/**
 * Reframe product photos onto a warm champagne studio canvas.
 * Keeps the COMPLETE product visible at ~70% of the frame (never over-crops).
 * Uploads to Supabase product-images and updates image_url.
 */
import fs from 'fs'
import path from 'path'
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
const PRODUCT_RATIO = 0.72 // product occupies ~72% of canvas
const BG = { r: 232, g: 222, b: 208, alpha: 1 } // warm champagne beige

const HOMEPAGE_NAMES = [
  'Diwali sweets dry-fruit hamper',
  'Eco green living kit',
  'Festive dry fruit wooden tray',
  'Desk essentials starter kit',
  'Matte black travel tumbler',
  'Navy laptop daypack',
  'Wireless mechanical keyboard',
  'Wood desk organiser tray',
  'Forest hardcover notebook set',
  'Black softshell corporate jacket',
  'Forest green corporate polo',
  'Navy corporate polo shirt',
  'Sticky notes desk set',
  'Achievement medal with ribbon',
  'Rolled wellness yoga mat',
  'Essential oil wellness trio',
  'Leather key organiser',
  'Spiral A5 daily planner',
  'Structured beige tote',
  'White crew neck tee',
  'Tech desk tidy gift set',
  'Structured briefcase portfolio',
  'Silver cup trophy',
  'New joiner onboarding hamper',
  'Office caddy welcome set',
  'First-day essentials pouch',
  'Leadership recognition hamper',
  'Acacia serving tray',
  'Festive corporate hamper crate',
  'Festival hamper crate',
  'Starter welcome essentials kit',
  'Induction gift crate',
  'Premium induction gift box',
  'Crystal recognition plaque',
  'Obelisk crystal tower',
  'Glass globe trophy',
  'Chocolate truffle tower',
  'Cotton waffle bathrobe',
  'Quilted laptop messenger',
  'Calm hour gift set',
  '65W dual-port GaN charger',
  'Lightweight windbreaker shell',
  'Weekender duffle',
  'Coffee connoisseur box',
  'Executive onboarding folio',
  'Fleece lounge throw',
  'Softshell jacket',
  'Meditation cushion mini',
  'Bamboo wireless charger pad',
  'Insulated coffee tumbler with lid',
  'Charcoal weekender duffle',
  'Wireless charging pad',
  'Executive pen set',
  'Noise cancelling earbuds',
  'Over-ear studio headphones',
  'Portable Bluetooth speaker',
]

function isNearBg(r, g, b) {
  // cream / white letterbox OR near-white studio walls
  return r > 225 && g > 215 && b > 195 && Math.abs(r - g) < 30 && Math.abs(g - b) < 35
}

async function contentBox(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const w = info.width
  const h = info.height
  let top = 0
  let bottom = h - 1
  let left = 0
  let right = w - 1
  const rowEmpty = (y) => {
    let empty = 0
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (isNearBg(data[i], data[i + 1], data[i + 2])) empty += 1
    }
    return empty / w > 0.92
  }
  const colEmpty = (x) => {
    let empty = 0
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4
      if (isNearBg(data[i], data[i + 1], data[i + 2])) empty += 1
    }
    return empty / h > 0.92
  }
  while (top < h && rowEmpty(top)) top += 1
  while (bottom > top && rowEmpty(bottom)) bottom -= 1
  while (left < w && colEmpty(left)) left += 1
  while (right > left && colEmpty(right)) right -= 1
  let cw = right - left + 1
  let ch = bottom - top + 1
  if (cw < w * 0.35 || ch < h * 0.35) {
    // detection failed — use mild inset only
    left = Math.round(w * 0.04)
    top = Math.round(h * 0.04)
    cw = Math.round(w * 0.92)
    ch = Math.round(h * 0.92)
  }
  // tiny padding inside content so we don't clip product edges
  const pad = Math.round(Math.min(cw, ch) * 0.02)
  left = Math.max(0, left - pad)
  top = Math.max(0, top - pad)
  cw = Math.min(w - left, cw + pad * 2)
  ch = Math.min(h - top, ch + pad * 2)
  return { left, top, width: cw, height: ch }
}

async function reframe(buf) {
  const box = await contentBox(buf)
  const extracted = await sharp(buf).extract(box).png().toBuffer()
  const target = Math.round(SIZE * PRODUCT_RATIO)
  const product = await sharp(extracted)
    .resize(target, target, {
      fit: 'inside',
      withoutEnlargement: false,
      background: BG,
    })
    .png()
    .toBuffer()
  const meta = await sharp(product).metadata()
  const pw = meta.width || target
  const ph = meta.height || target
  const left = Math.round((SIZE - pw) / 2)
  const top = Math.round((SIZE - ph) / 2)

  // soft shadow under product
  const shadow = await sharp({
    create: {
      width: Math.round(pw * 0.92),
      height: Math.max(18, Math.round(ph * 0.06)),
      channels: 4,
      background: { r: 40, g: 30, b: 20, alpha: 0.18 },
    },
  })
    .blur(12)
    .png()
    .toBuffer()

  return sharp({
    create: { width: SIZE, height: SIZE, channels: 3, background: BG },
  })
    .composite([
      {
        input: shadow,
        left: Math.round((SIZE - pw * 0.92) / 2),
        top: top + ph - Math.round(ph * 0.04),
      },
      { input: product, left, top },
    ])
    .webp({ quality: 88 })
    .toBuffer()
}

async function main() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: products, error } = await admin
    .from('products')
    .select('id, name, image_url, sku')
    .in('name', HOMEPAGE_NAMES)
  if (error) throw new Error(error.message)

  fs.mkdirSync('tmp/studio-reframe', { recursive: true })
  const results = []
  let replaced = 0
  let failed = 0
  let skipped = 0

  for (const product of products || []) {
    try {
      let sourceBuf = null
      let sourceUrl = product.image_url
      if (sourceUrl && String(sourceUrl).startsWith('/')) {
        const localPath = path.join(process.cwd(), 'public', sourceUrl.replace(/^\//, ''))
        if (fs.existsSync(localPath)) {
          sourceBuf = fs.readFileSync(localPath)
        } else {
          skipped += 1
          results.push({ name: product.name, status: 'skipped_local_missing' })
          continue
        }
      } else if (sourceUrl) {
        const res = await fetch(sourceUrl)
        if (!res.ok) throw new Error('fetch ' + res.status)
        sourceBuf = Buffer.from(await res.arrayBuffer())
      } else {
        skipped += 1
        results.push({ name: product.name, status: 'skipped_no_url' })
        continue
      }
      const out = await reframe(sourceBuf)
      const objectPath = `${product.id}/studio-pack-${Date.now()}.webp`
      const { error: upErr } = await admin.storage
        .from('product-images')
        .upload(objectPath, out, { contentType: 'image/webp', upsert: true })
      if (upErr) throw new Error(upErr.message)
      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/product-images/${objectPath}`
      const { error: updErr } = await admin.from('products').update({ image_url: publicUrl }).eq('id', product.id)
      if (updErr) throw new Error(updErr.message)
      fs.writeFileSync(path.join('tmp/studio-reframe', `${product.id}.webp`), out)
      replaced += 1
      results.push({ name: product.name, status: 'ok', url: publicUrl })
      console.log('ok', product.name)
    } catch (e) {
      failed += 1
      results.push({ name: product.name, status: 'fail', error: String(e.message || e) })
      console.error('fail', product.name, e.message || e)
    }
  }

  fs.writeFileSync('tmp/studio-reframe-results.json', JSON.stringify({ replaced, failed, skipped, results }, null, 2))
  console.log(JSON.stringify({ replaced, failed, skipped, total: (products || []).length }))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
