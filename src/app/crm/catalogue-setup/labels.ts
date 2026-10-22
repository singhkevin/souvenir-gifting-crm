import type { SectionType } from '@/lib/homepage/types'

export const SECTION_LABELS: Record<SectionType, { name: string; about: string }> = {
  hero: { name: 'Hero', about: 'Charcoal opening band: headline, two buttons, stat strip and the featured gifts slider.' },
  occasion_grid: { name: 'Occasion cards', about: 'Cards that each open a collection; photos and the From price come from that collection.' },
  product_rail: { name: 'Product rail', about: 'A row of product cards from a collection, or the automatic bestseller picks.' },
  brand_row: { name: 'Brand row', about: 'Logos of brands with live products. Brands listed as hidden in site content are left out.' },
  packaging: { name: 'Packaging strip', about: 'Two photos and up to five tiles about packaging and delivery.' },
  catalogue_grid: { name: 'Catalogue grid', about: 'The filterable live catalogue at the end of the page.' },
}
