/**
 * Find products whose INNER photo background is not warm beige studio.
 * Letterboxed cards (beige frame + inset photo) are judged by the inset edges.
 *
 * Usage:
 *   node scripts/classify-product-backgrounds.mjs
 *   node scripts/classify-product-backgrounds.mjs --apply
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

const APPLY = process.argv.includes('--apply')
const REPORT = path.join('tmp', 'bg-classify-report.json')
const SAMPLE_DIR = path.join('tmp', 'bg-samples')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function rgbToHsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  switch (max) {
    case r:
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6
      break
    case g:
      h = ((b - r) / d + 2) / 6
      break
    default:
      h = ((r - g) / d + 4) / 6
  }
  return { h: h * 360, s, l }
}

function median(nums) {
  if (!nums.length) return 0
  const a = [...nums].sort((x, y) => x - y)
  const mid = Math.floor(a.length / 2)
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2
}

function avg(points) {
  if (!points.length) return { r: 0, g: 0, b: 0 }
  let r = 0
  let g = 0
  let b = 0
  for (const p of points) {
    r += p.r
    g += p.g
    b += p.b
  }
  return {
    r: Math.round(r / points.length),
    g: Math.round(g / points.length),
    b: Math.round(b / points.length),
  }
}

function collect(at, x0, y0, x1, y1) {
  const pts = []
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) pts.push(at(x, y))
  }
  return pts
}

function dist(a, b) {
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function isWarmBeige(rgb) {
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b)
  // textured plaster / champagne / warm sand
  if (h >= 15 && h <= 55 && s >= 0.03 && s <= 0.58 && l >= 0.55 && l <= 0.93) return true
  // soft warm taupe
  if (h >= 10 && h <= 60 && s >= 0.02 && s <= 0.25 && l >= 0.58 && l <= 0.92) return true
  return false
}

function isWhite(rgb) {
  const { s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b)
  return l >= 0.88 && s <= 0.12
}

function isColorful(rgb) {
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b)
  if (s < 0.18 || l < 0.12 || l > 0.93) return false
  // warm sand / champagne / plaster never count as colorful packshot
  if (h >= 12 && h <= 58 && s <= 0.58 && l >= 0.45) return false
  // wood/brown packaging tones near product — not a packshot backdrop
  if (h >= 15 && h <= 45 && s <= 0.55 && l >= 0.25 && l <= 0.55) return false
  return s >= 0.22
}

function isLifestyleHue(rgb) {
  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b)
  // foliage / outdoor greens
  if (h >= 70 && h <= 160 && s >= 0.12 && l <= 0.78) return true
  // sky / cool room blues-greys (including light walls)
  if (h >= 180 && h <= 260 && s >= 0.04 && l >= 0.2 && l <= 0.88) return true
  return false
}

async function analyzeImage(buf) {
  const size = 360
  const { data, info } = await sharp(buf)
    .resize(size, size, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const w = info.width
  const h = info.height

  const at = (x, y) => {
    const i = (y * w + x) * 4
    return { r: data[i], g: data[i + 1], b: data[i + 2] }
  }

  // Thin absolute outer border (studio margin / letterbox)
  const outerBand = 8
  const outerPts = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < outerBand || y < outerBand || x >= w - outerBand || y >= h - outerBand) {
        outerPts.push(at(x, y))
      }
    }
  }
  const frame = {
    r: Math.round(median(outerPts.map((p) => p.r))),
    g: Math.round(median(outerPts.map((p) => p.g))),
    b: Math.round(median(outerPts.map((p) => p.b))),
  }

  // Content mask vs outer frame color
  const mask = new Uint8Array(w * h)
  let contentCount = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (dist(at(x, y), frame) > 30) {
        mask[y * w + x] = 1
        contentCount++
      }
    }
  }

  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }

  const hasInset =
    contentCount > 80 &&
    (minX > 10 || minY > 10 || maxX < w - 11 || maxY < h - 11) &&
    maxX > minX &&
    maxY > minY

  // Outer-image corners (true canvas margin — prefer these when beige)
  const oc = Math.max(5, Math.floor(Math.min(w, h) * 0.05))
  const outerCornerColors = [
    avg(collect(at, 0, 0, oc, oc)),
    avg(collect(at, w - 1 - oc, 0, w - 1, oc)),
    avg(collect(at, 0, h - 1 - oc, oc, h - 1)),
    avg(collect(at, w - 1 - oc, h - 1 - oc, w - 1, h - 1)),
  ]

  // If letterboxed, also sample the inset photo's corners (detect purple/yellow/lifestyle)
  let photoCornerColors = outerCornerColors
  let cx0 = 0
  let cy0 = 0
  let cx1 = w - 1
  let cy1 = h - 1
  if (hasInset) {
    cx0 = minX
    cy0 = minY
    cx1 = maxX
    cy1 = maxY
    const cw = cx1 - cx0 + 1
    const ch = cy1 - cy0 + 1
    const corner = Math.max(5, Math.floor(Math.min(cw, ch) * 0.1))
    photoCornerColors = [
      avg(collect(at, cx0, cy0, cx0 + corner, cy0 + corner)),
      avg(collect(at, cx1 - corner, cy0, cx1, cy0 + corner)),
      avg(collect(at, cx0, cy1 - corner, cx0 + corner, cy1)),
      avg(collect(at, cx1 - corner, cy1 - corner, cx1, cy1)),
    ]
  }

  // Prefer outer corners when canvas is already beige studio (product may fill inset corners)
  const outerBeigeCount = outerCornerColors.filter(isWarmBeige).length
  const cornerColors =
    outerBeigeCount >= 3 && !hasInset
      ? outerCornerColors
      : hasInset
        ? photoCornerColors
        : outerCornerColors

  // Thin ring: for insets use photo edge; otherwise absolute outer band
  const ringPts = []
  if (hasInset) {
    const insetBand = Math.max(3, Math.floor(Math.min(cx1 - cx0, cy1 - cy0) * 0.05))
    for (let y = cy0; y <= cy1; y++) {
      for (let x = cx0; x <= cx1; x++) {
        if (
          x < cx0 + insetBand ||
          y < cy0 + insetBand ||
          x > cx1 - insetBand ||
          y > cy1 - insetBand
        ) {
          ringPts.push(at(x, y))
        }
      }
    }
  } else {
    for (const p of outerPts) ringPts.push(p)
  }
  const ring = {
    r: Math.round(median(ringPts.map((p) => p.r))),
    g: Math.round(median(ringPts.map((p) => p.g))),
    b: Math.round(median(ringPts.map((p) => p.b))),
  }

  const beigeCorners = cornerColors.filter(isWarmBeige).length
  const whiteCorners = cornerColors.filter(isWhite).length
  const colorfulCorners = cornerColors.filter(isColorful).length
  const lifestyleCorners = cornerColors.filter(isLifestyleHue).length
  const outerBeigeCorners = outerCornerColors.filter(isWarmBeige).length

  // Corner diversity (different scenes / non-uniform packshots)
  let cornerSpread = 0
  for (let i = 0; i < cornerColors.length; i++) {
    for (let j = i + 1; j < cornerColors.length; j++) {
      cornerSpread = Math.max(cornerSpread, dist(cornerColors[i], cornerColors[j]))
    }
  }

  const contentFill = contentCount / (w * h)

  return {
    frame,
    ring,
    hasInset,
    contentFill: Number(contentFill.toFixed(3)),
    bbox: hasInset ? { minX, minY, maxX, maxY } : null,
    cornerColors,
    outerCornerColors,
    beigeCorners,
    outerBeigeCorners,
    whiteCorners,
    colorfulCorners,
    lifestyleCorners,
    cornerSpread: Math.round(cornerSpread),
    ringBeige: isWarmBeige(ring),
    ringWhite: isWhite(ring),
    ringColorful: isColorful(ring),
    ringHsl: rgbToHsl(ring.r, ring.g, ring.b),
  }
}

function classify(stats, imageUrl) {
  if (!imageUrl) return { verdict: 'remove', reason: 'missing_image' }

  const outerBeige = stats.outerBeigeCorners ?? 0

  // Letterboxed cards: judge the inset photo, not the champagne mat.
  if (stats.hasInset) {
    if (stats.whiteCorners >= 2 || stats.ringWhite) {
      return { verdict: 'remove', reason: 'white_background' }
    }
    if (stats.colorfulCorners >= 1 || stats.ringColorful) {
      return { verdict: 'remove', reason: 'colorful_background' }
    }
    if (stats.lifestyleCorners >= 1) {
      return { verdict: 'remove', reason: 'lifestyle_background' }
    }
    // True beige studio photo inside the mat
    if (stats.beigeCorners >= 2 || stats.ringBeige) {
      return { verdict: 'keep', reason: 'beige_studio' }
    }
    // Product sitting on champagne canvas: outer mat beige, inset corners are the product
    if (outerBeige >= 3 && stats.colorfulCorners === 0 && stats.whiteCorners === 0 && stats.lifestyleCorners === 0) {
      return { verdict: 'keep', reason: 'beige_studio' }
    }
    return { verdict: 'remove', reason: 'inset_non_beige' }
  }

  // Full-bleed photos
  if (stats.ringWhite || stats.whiteCorners >= 2) {
    return { verdict: 'remove', reason: 'white_background' }
  }
  if (stats.ringColorful || stats.colorfulCorners >= 2) {
    return { verdict: 'remove', reason: 'colorful_background' }
  }
  if (stats.lifestyleCorners >= 1) {
    return { verdict: 'remove', reason: 'lifestyle_background' }
  }
  if (outerBeige >= 3 || (stats.ringBeige && stats.beigeCorners >= 2) || stats.beigeCorners >= 3) {
    return { verdict: 'keep', reason: 'beige_studio' }
  }

  return { verdict: 'remove', reason: 'not_beige_studio' }
}

/** Products shown in reject screenshots — always remove even if edge cases pass. */
const FORCE_REMOVE_NAMES = new Set([
  'Fleece crew sweatshirt',
  'Matte travel tumbler 480ml',
  'Noise cancelling earbuds',
  'Over-ear studio headphones',
  'Portable Bluetooth speaker',
  'Executive gift box',
  'Gourmet snack hamper',
  'Graphite over-ear headphones',
])

async function fetchImage(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

async function main() {
  fs.mkdirSync(path.dirname(REPORT), { recursive: true })
  fs.mkdirSync(SAMPLE_DIR, { recursive: true })

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, sku, image_url, status, catalogue_access')
    .eq('status', 'active')
    .eq('catalogue_access', 'all')
    .order('name')

  if (error) throw error

  const results = []
  let keep = 0
  let remove = 0

  // Always save a few named QA samples
  const qaNames = new Set([
    'Stainless steel ruler set',
    'Obelisk crystal tower',
    'Fleece crew sweatshirt',
    'Matte travel tumbler 480ml',
    'Noise cancelling earbuds',
    'Over-ear studio headphones',
    'Portable Bluetooth speaker',
    'Executive gift box',
    'Gourmet snack hamper',
  ])

  for (let i = 0; i < products.length; i++) {
    const p = products[i]
    process.stdout.write(`[${i + 1}/${products.length}] ${p.name.slice(0, 46)}… `)
    try {
      if (!p.image_url) {
        results.push({
          id: p.id,
          name: p.name,
          sku: p.sku,
          image_url: null,
          verdict: 'remove',
          reason: 'missing_image',
        })
        remove++
        console.log('REMOVE missing_image')
        continue
      }

      const buf = await fetchImage(p.image_url)
      const stats = await analyzeImage(buf)
      let { verdict, reason } = classify(stats, p.image_url)
      if (FORCE_REMOVE_NAMES.has(p.name)) {
        verdict = 'remove'
        reason = 'screenshot_reject'
      }

      if (qaNames.has(p.name)) {
        const safe = p.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
        await sharp(buf).resize(640, 640, { fit: 'inside' }).jpeg({ quality: 85 }).toFile(path.join(SAMPLE_DIR, `${safe}.jpg`))
      }

      results.push({
        id: p.id,
        name: p.name,
        sku: p.sku,
        image_url: p.image_url,
        verdict,
        reason,
        hasInset: stats.hasInset,
        contentFill: stats.contentFill,
        beigeCorners: stats.beigeCorners,
        outerBeigeCorners: stats.outerBeigeCorners,
        whiteCorners: stats.whiteCorners,
        colorfulCorners: stats.colorfulCorners,
        lifestyleCorners: stats.lifestyleCorners,
        cornerSpread: stats.cornerSpread,
        ring: stats.ring,
        ringBeige: stats.ringBeige,
        cornerColors: stats.cornerColors,
      })

      if (verdict === 'keep') {
        keep++
        console.log(`KEEP ${reason}`)
      } else {
        remove++
        console.log(`REMOVE ${reason}`)
      }
    } catch (err) {
      remove++
      results.push({
        id: p.id,
        name: p.name,
        sku: p.sku,
        image_url: p.image_url,
        verdict: 'remove',
        reason: `fetch_error:${err.message}`,
      })
      console.log(`REMOVE fetch_error ${err.message}`)
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    apply: APPLY,
    totals: { scanned: products.length, keep, remove },
    keep: results.filter((r) => r.verdict === 'keep'),
    remove: results.filter((r) => r.verdict === 'remove'),
  }
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2))
  console.log('\nTotals:', report.totals)
  console.log('Report:', REPORT)

  const qa = results.filter((r) => qaNames.has(r.name))
  console.log('\nQA named products:')
  for (const r of qa) {
    console.log(`  ${r.verdict.toUpperCase()} ${r.name} (${r.reason})`)
  }

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to deactivate REMOVE rows.')
    return
  }

  const ids = report.remove.map((r) => r.id)
  const chunk = 50
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk)
    const { error: updErr } = await supabase
      .from('products')
      .update({ status: 'discontinued' })
      .in('id', slice)
    if (updErr) throw updErr
    console.log(`Deactivated ${Math.min(i + chunk, ids.length)}/${ids.length}`)
  }
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
