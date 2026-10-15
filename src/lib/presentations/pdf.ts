import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from 'pdf-lib'

export type DeckSlide = {
  title: string
  specs: string
  price: number
  moq: number
  kind: 'product' | 'combo'
  memberNames: string[]
  image?: Uint8Array | null
}

export type DeckPdfInput = {
  title: string
  clientName: string
  notes: string
  organisation: string
  phone: string | null
  slides: DeckSlide[]
  showPrices?: boolean
}

const PAGE: [number, number] = [841.89, 595.28]
const INK = rgb(0.14, 0.11, 0.07)
const MUTED = rgb(0.36, 0.4, 0.44)
const GOLD = rgb(0.5, 0.42, 0.31)
const PAPER = rgb(0.965, 0.957, 0.945)

function ascii(value: string) {
  return value.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim()
}

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const words = ascii(text).split(' ').filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(next, size) > width && line) {
      lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawLines(page: PDFPage, lines: string[], font: PDFFont, size: number, x: number, y: number, color: ReturnType<typeof rgb>) {
  let cursor = y
  for (const line of lines) {
    page.drawText(line, { x, y: cursor, size, font, color })
    cursor -= size + 4
  }
  return cursor
}

async function embed(doc: PDFDocument, bytes: Uint8Array | null | undefined): Promise<PDFImage | null> {
  if (!bytes || bytes.length < 8) return null
  try {
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return await doc.embedJpg(bytes)
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return await doc.embedPng(bytes)
    const sharp = (await import('sharp')).default
    const png = await sharp(bytes).png().toBuffer()
    return await doc.embedPng(png)
  } catch {
    return null
  }
}

function money(amount: number) {
  return `INR ${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export async function buildPresentationPdf(input: DeckPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const serif = await doc.embedFont(StandardFonts.TimesRoman)
  const serifBold = await doc.embedFont(StandardFonts.TimesRomanBold)
  const sans = await doc.embedFont(StandardFonts.Helvetica)
  const sansBold = await doc.embedFont(StandardFonts.HelveticaBold)

  const cover = doc.addPage(PAGE)
  cover.drawRectangle({ x: 0, y: 0, width: PAGE[0], height: PAGE[1], color: PAPER })
  cover.drawRectangle({ x: 0, y: PAGE[1] - 12, width: PAGE[0], height: 12, color: GOLD })
  cover.drawText(ascii(input.organisation).slice(0, 80) || 'Souvenir', {
    x: 64, y: 470, size: 12, font: sans, color: GOLD,
  })
  const titleLines = wrap(input.title || 'Presentation', serifBold, 40, 680).slice(0, 3)
  drawLines(cover, titleLines, serifBold, 40, 64, 400, INK)
  cover.drawText(ascii(`Prepared for ${input.clientName || 'the client'}`).slice(0, 90), {
    x: 64, y: 250, size: 16, font: sans, color: MUTED,
  })
  if (input.notes) {
    drawLines(cover, wrap(input.notes, sans, 12, 640).slice(0, 4), sans, 12, 64, 200, MUTED)
  }

  for (const slide of input.slides) {
    const page = doc.addPage(PAGE)
    page.drawRectangle({ x: 0, y: 0, width: PAGE[0], height: PAGE[1], color: rgb(1, 1, 1) })
    page.drawRectangle({ x: 48, y: 78, width: 340, height: 440, color: PAPER })
    const image = await embed(doc, slide.image)
    if (image) {
      const scale = Math.min(300 / image.width, 400 / image.height)
      const width = image.width * scale
      const height = image.height * scale
      page.drawImage(image, { x: 48 + (340 - width) / 2, y: 78 + (440 - height) / 2, width, height })
    }
    const x = 420
    drawLines(page, wrap(slide.title, serifBold, 26, 360).slice(0, 3), serifBold, 26, x, 490, INK)
    const kind = slide.kind === 'combo' ? 'Combo' : 'Product'
    page.drawText(kind, { x, y: 400, size: 11, font: sansBold, color: GOLD })
    let y = 376
    if (slide.memberNames.length) {
      y = drawLines(page, wrap(slide.memberNames.join(', '), sans, 11, 360).slice(0, 3), sans, 11, x, y, MUTED)
      y -= 8
    }
    if (slide.specs) {
      y = drawLines(page, wrap(slide.specs, sans, 12, 360).slice(0, 8), sans, 12, x, y, INK)
      y -= 16
    }
    if (input.showPrices !== false) {
      page.drawText(money(slide.price), { x, y: Math.min(y, 180), size: 20, font: sansBold, color: INK })
    }
    page.drawText(`MOQ ${slide.moq}`, { x, y: Math.min(y, 180) - 24, size: 12, font: sans, color: MUTED })
  }

  const close = doc.addPage(PAGE)
  close.drawRectangle({ x: 0, y: 0, width: PAGE[0], height: PAGE[1], color: INK })
  close.drawText(ascii(input.organisation).slice(0, 80) || 'Souvenir', {
    x: 64, y: 340, size: 32, font: serifBold, color: rgb(1, 1, 1),
  })
  close.drawText('Thank you', { x: 64, y: 290, size: 16, font: sans, color: GOLD })
  const phone = ascii(input.phone || '')
  close.drawText(phone ? `Contact ${phone}` : 'Contact the team through the public website.', {
    x: 64, y: 240, size: 14, font: sans, color: rgb(0.95, 0.94, 0.92),
  })

  return doc.save()
}
