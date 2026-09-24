/** Multi-item budget kits: 2–4 SKUs whose combined sell price ≤ per-person budget. */

export type BudgetPackCandidate = {
  id: string
  name: string
  sellPrice: number
}

export type BudgetPackKit = {
  packOption: 'A' | 'B' | 'C'
  productIds: string[]
  totalSellPrice: number
}

const KIT_MIN_ITEMS = 2
const KIT_MAX_ITEMS = 4

const OPTION_STRATEGIES: Array<{
  packOption: 'A' | 'B' | 'C'
  strategy: 'value' | 'balanced' | 'premium'
}> = [
  { packOption: 'C', strategy: 'value' },
  { packOption: 'A', strategy: 'balanced' },
  { packOption: 'B', strategy: 'premium' },
]

function sumPrices(items: BudgetPackCandidate[]) {
  return items.reduce((s, i) => s + i.sellPrice, 0)
}

/** Greedy kit: add items in order while sum ≤ budget and count ≤ max. */
function greedyKit(
  ordered: BudgetPackCandidate[],
  budget: number,
  minItems: number,
  maxItems: number
): BudgetPackCandidate[] {
  const picked: BudgetPackCandidate[] = []
  for (const item of ordered) {
    if (picked.some((p) => p.id === item.id)) continue
    const next = [...picked, item]
    if (sumPrices(next) > budget) continue
    picked.push(item)
    if (picked.length >= maxItems) break
  }
  if (picked.length < minItems) return []
  return picked
}

function buildKitForStrategy(
  candidates: BudgetPackCandidate[],
  budget: number,
  strategy: 'value' | 'balanced' | 'premium'
): BudgetPackCandidate[] {
  const byPriceAsc = [...candidates].sort((a, b) => a.sellPrice - b.sellPrice)
  const byPriceDesc = [...byPriceAsc].reverse()

  if (strategy === 'value') {
    return greedyKit(byPriceAsc, budget, KIT_MIN_ITEMS, KIT_MAX_ITEMS)
  }

  if (strategy === 'premium') {
    const kit = greedyKit(byPriceDesc, budget, KIT_MIN_ITEMS, KIT_MAX_ITEMS)
    if (kit.length >= KIT_MIN_ITEMS) return kit
    return greedyKit(byPriceAsc, budget, KIT_MIN_ITEMS, KIT_MAX_ITEMS)
  }

  // Balanced: start from mid-priced items, then grow.
  const mid = Math.floor(byPriceAsc.length / 2)
  const rotated = [...byPriceAsc.slice(mid), ...byPriceAsc.slice(0, mid)]
  const kit = greedyKit(rotated, budget, KIT_MIN_ITEMS, KIT_MAX_ITEMS)
  if (kit.length >= KIT_MIN_ITEMS) return kit
  return greedyKit(byPriceAsc, budget, KIT_MIN_ITEMS, KIT_MAX_ITEMS)
}

/** Fallback: single-SKU option when a 2+ item kit is impossible. */
function singleItemKit(
  candidates: BudgetPackCandidate[],
  budget: number,
  strategy: 'value' | 'balanced' | 'premium'
): BudgetPackCandidate[] {
  const eligible = candidates.filter((c) => c.sellPrice > 0 && c.sellPrice <= budget)
  if (!eligible.length) return []
  const sorted = [...eligible].sort((a, b) => a.sellPrice - b.sellPrice)
  if (strategy === 'premium') return [sorted[sorted.length - 1]]
  if (strategy === 'balanced') return [sorted[Math.floor((sorted.length - 1) / 2)]]
  return [sorted[0]]
}

export function pickBudgetPackKits(
  candidates: BudgetPackCandidate[],
  budgetPerPerson: number,
  maxOptions = 3
): BudgetPackKit[] {
  if (!Number.isFinite(budgetPerPerson) || budgetPerPerson <= 0) return []
  const pool = candidates.filter((c) => c.sellPrice > 0)
  if (!pool.length) return []

  const usedProducts = new Set<string>()
  const kits: BudgetPackKit[] = []

  for (const { packOption, strategy } of OPTION_STRATEGIES) {
    if (kits.length >= maxOptions) break

    const available = pool.filter((c) => !usedProducts.has(c.id))
    let items = buildKitForStrategy(available, budgetPerPerson, strategy)

    if (items.length < KIT_MIN_ITEMS) {
      items = singleItemKit(available, budgetPerPerson, strategy)
    }
    if (!items.length) continue

    const total = sumPrices(items)
    if (total > budgetPerPerson) continue

    items.forEach((i) => usedProducts.add(i.id))
    kits.push({
      packOption,
      productIds: items.map((i) => i.id),
      totalSellPrice: Math.round((total + Number.EPSILON) * 100) / 100,
    })
  }

  return kits.sort((a, b) => a.packOption.localeCompare(b.packOption))
}

/** @deprecated use pickBudgetPackKits */
export function pickBudgetPackOptions(
  candidates: Array<{ id: string; sellPrice: number }>,
  budgetPerPerson: number,
  maxOptions = 3
) {
  const named = candidates.map((c) => ({ ...c, name: c.id }))
  return pickBudgetPackKits(named, budgetPerPerson, maxOptions).map((k) => ({
    packOption: k.packOption,
    productId: k.productIds[0],
    sellPrice: k.totalSellPrice,
  }))
}

export const PACK_OPTION_LABELS: Record<'A' | 'B' | 'C', string> = {
  A: 'Option A — Balanced kit',
  B: 'Option B — Premium kit',
  C: 'Option C — Value kit',
}

export function formatKitItemNames(names: string[]) {
  if (names.length <= 2) return names.join(' + ')
  return `${names.slice(0, -1).join(', ')} + ${names[names.length - 1]}`
}
