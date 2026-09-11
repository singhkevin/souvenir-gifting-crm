/**
 * Detect cream/letterboxed catalogue photos, crop to full-bleed squares,
 * write public/catalogue-fill/{id}.webp and a SQL-ready update list.
 */
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const LIST =
  process.env.PRODUCTS_JSON ||
  path.join(
    process.env.USERPROFILE || '',
    '.cursor/projects/c-VI-Corporate-Gifting-giffter/agent-tools/d9ea5680-fbc8-4e42-a324-bf42d964d105.txt',
  )

function loadProducts(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  const tagged = raw.match(/<untrusted-data-[^>]+>\s*(\[[\s\S]*?\])\s*<\/untrusted-data-[^>]+>/)
  if (tagged) return JSON.parse(tagged[1])
  const start = raw.indexOf('[')
  const end = raw.lastIndexOf(']')
  if (start < 0 || end < 0) throw new Error('no product array in ' + filePath)
  return JSON.parse(raw.slice(start, end + 1))
}

function isCreamPixel(data, i) {
  const r = data[i]
  const g = data[i + 1]
  const b = data[i + 2]
  return r > 220 && g > 210 && b > 190 && Math.abs(r - g) < 28 && Math.abs(g - b) < 32
}

async function creamEdgeRatio(buf) {
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .resize(200, 200, { fit: 'fill' })
    .raw()
    .toBuffer({ resolveWithObject: true })
  const w = info.width
  const h = info.height
  let edge = 0
  let cream = 0
  for (let x = 0; x < w; x++) {
    for (const y of [0, 1, 2, h - 1, h - 2, h - 3]) {
      edge += 1
      if (isCreamPixel(data, (y * w + x) * 4)) cream += 1
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, 1, 2, w - 1, w - 2, w - 3]) {
      edge += 1
      if (isCreamPixel(data, (y * w + x) * 4)) cream += 1
    }
  }
  return cream / edge
}

async function cropToFill(buf, outPath) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const w = info.width
  const h = info.height
  let top = 0
  let bottom = h - 1
  let left = 0
  let right = w - 1
  const rowCream = (y) => {
    let c = 0
    for (let x = 0; x < w; x++) if (isCreamPixel(data, (y * w + x) * 4)) c += 1
    return c / w > 0.82
  }
  const colCream = (x) => {
    let c = 0
    for (let y = 0; y < h; y++) if (isCreamPixel(data, (y * w + x) * 4)) c += 1
    return c / h > 0.82
  }
  while (top < h && rowCream(top)) top += 1
  while (bottom > top && rowCream(bottom)) bottom -= 1
  while (left < w && colCream(left)) left += 1
  while (right > left && colCream(right)) right -= 1
  let cw = right - left + 1
  let ch = bottom - top + 1
  if (cw < w * 0.45 || ch < h * 0.45) {
    left = Math.round(w * 0.08)
    top = Math.round(h * 0.08)
    cw = Math.round(w * 0.84)
    ch = Math.round(h * 0.84)
  }
  const zoom = 0.06
  const zx = Math.round(cw * zoom)
  const zy = Math.round(ch * zoom)
  left = Math.max(0, left + zx)
  top = Math.max(0, top + zy)
  cw = Math.min(w - left, cw - 2 * zx)
  ch = Math.min(h - top, ch - 2 * zy)
  const side = Math.min(cw, ch)
  left += Math.floor((cw - side) / 2)
  top += Math.floor((ch - side) / 2)
  await sharp(buf)
    .extract({ left, top, width: side, height: side })
    .resize(1200, 1200, { kernel: 'lanczos3' })
    .webp({ quality: 90 })
    .toFile(outPath)
}

async function main() {
  const products = loadProducts(LIST)
  fs.mkdirSync('public/catalogue-fill', { recursive: true })
  fs.mkdirSync('tmp', { recursive: true })

  const updates = []
  let i = 0
  let fixed = 0
  let skipped = 0
  let failed = 0
  const concurrency = 6

  async function worker() {
    while (i < products.length) {
      const idx = i
      i += 1
      const product = products[idx]
      const url = product.image_url
      if (!url || String(url).startsWith('/')) {
        skipped += 1
        continue
      }
      try {
        const res = await fetch(url)
        if (!res.ok) {
          failed += 1
          continue
        }
        const buf = Buffer.from(await res.arrayBuffer())
        const ratio = await creamEdgeRatio(buf)
        if (ratio < 0.35) {
          skipped += 1
          continue
        }
        const out = path.join('public', 'catalogue-fill', `${product.id}.webp`)
        await cropToFill(buf, out)
        updates.push({
          id: product.id,
          name: product.name,
          path: `/catalogue-fill/${product.id}.webp`,
          ratio: Number(ratio.toFixed(2)),
        })
        fixed += 1
        if (fixed % 15 === 0) console.log('fixed', fixed, product.name)
      } catch {
        failed += 1
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  fs.writeFileSync('tmp/catalogue-fill-updates.json', JSON.stringify(updates, null, 2))
  console.log(JSON.stringify({ total: products.length, fixed, skipped, failed }))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
