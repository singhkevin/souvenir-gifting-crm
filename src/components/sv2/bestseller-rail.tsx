'use client'

import { useState } from 'react'
import { SV2ProductCard } from '@/components/sv2/product-card'

export interface BestsellerProduct {
  id: string
  name: string
  sku: string | null
  imageUrl: string | null
  description: string | null
  price: number | null
  priceText?: string | null
  moq: number
  categoryName?: string | null
  occasionTags?: string[]
}

const TABS = [
  { id: 'all', label: 'All Items' },
  { id: 'desk', label: 'Executive Desk' },
  { id: 'drinkware', label: 'Hydration' },
  { id: 'festive', label: 'Gourmet Hampers' },
  { id: 'eco', label: 'Eco & Sustainable' },
] as const

export function BestsellerRail({ products }: { products: BestsellerProduct[] }) {
  const [activeTab, setActiveTab] = useState<string>('all')

  const filtered = products.filter((item) => {
    if (activeTab === 'all') return true
    const text = `${item.name} ${item.description || ''} ${item.categoryName || ''} ${(item.occasionTags || []).join(' ')}`.toLowerCase()

    if (activeTab === 'desk') {
      return text.includes('desk') || text.includes('leather') || text.includes('notebook') || text.includes('organizer') || text.includes('pen')
    }
    if (activeTab === 'drinkware') {
      return text.includes('drinkware') || text.includes('tumbler') || text.includes('flask') || text.includes('bottle') || text.includes('mug') || text.includes('copper')
    }
    if (activeTab === 'festive') {
      return text.includes('festive') || text.includes('hamper') || text.includes('saffron') || text.includes('diwali') || text.includes('gourmet')
    }
    if (activeTab === 'eco') {
      return text.includes('eco') || text.includes('canvas') || text.includes('sustainable') || text.includes('jute') || text.includes('bamboo') || text.includes('cotton')
    }
    return true
  })

  // If filter produces 0 items, show all to prevent empty space
  const itemsToDisplay = filtered.length > 0 ? filtered.slice(0, 5) : products.slice(0, 5)

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-1 border border-[#CCC5BD] p-1 bg-[#FCF9F2] mb-6 w-fit max-w-full">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1 sv2-label transition-colors ${
                isActive
                  ? 'bg-[#000000] text-[#FCF9F2]'
                  : 'text-[#4A4640] hover:text-[#000000] hover:bg-[#F6F3EC]'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* 2-Column Mobile Grid, 3-Column Tablet, 5-Column Desktop */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {itemsToDisplay.map((product) => (
          <SV2ProductCard
            key={product.id}
            id={product.id}
            name={product.name}
            sku={product.sku}
            imageUrl={product.imageUrl}
            description={product.description}
            price={product.price}
            priceText={product.priceText}
            moq={product.moq}
          />
        ))}
      </div>
    </div>
  )
}
