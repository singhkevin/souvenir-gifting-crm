'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { setOrderStage } from '@/app/crm/orders/actions'
import { ORDER_LIFECYCLE, ORDER_STATUS_LABELS, HEALTH_LABELS, HEALTH_STYLES, type OrderHealth } from '@/lib/order-workflow'
import { formatCurrency, formatDate } from '@/lib/utils'

export type KanbanCard = {
  id: string
  order_number: string
  status: string
  order_value: number | null
  expected_delivery_date: string | null
  health: OrderHealth
  companyName: string
  assigneeName: string
  departmentName: string
}

export function OrderKanban({
  orders,
  canDrag,
}: {
  orders: KanbanCard[]
  canDrag: boolean
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const onDrop = (status: string, orderId: string) => {
    if (!canDrag) return
    setError(null)
    start(async () => {
      const result = await setOrderStage(orderId, status)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
      {pending && <p className="text-[11px] text-[#7A7267]">Updating stage…</p>}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {ORDER_LIFECYCLE.map((column) => {
            const cards = orders.filter((o) => o.status === column || (column === 'procurement' && o.status === 'in_progress'))
            return (
              <div
                key={column}
                className="w-64 flex-shrink-0 bg-[#FAF7F2] rounded-2xl border border-[#E5DFD5] p-2"
                onDragOver={(e) => {
                  if (canDrag) e.preventDefault()
                }}
                onDrop={(e) => {
                  e.preventDefault()
                  const id = e.dataTransfer.getData('text/order-id')
                  if (id) onDrop(column, id)
                }}
              >
                <div className="flex items-center justify-between px-2 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#7A7267]">{ORDER_STATUS_LABELS[column]}</p>
                  <span className="text-[11px] text-[#806A50] font-semibold">{cards.length}</span>
                </div>
                <div className="space-y-2 min-h-[120px]">
                  {cards.map((card) => (
                    <article
                      key={card.id}
                      draggable={canDrag}
                      onDragStart={(e) => e.dataTransfer.setData('text/order-id', card.id)}
                      className={`bg-white rounded-xl border border-[#EFE9E0] p-3 ${canDrag ? 'cursor-grab' : ''}`}
                    >
                      <Link href={`/crm/orders/${card.id}`} className="font-mono text-xs font-semibold text-[#806A50] hover:underline">
                        {card.order_number}
                      </Link>
                      <p className="text-xs text-[#5A5248] mt-1">{card.companyName}</p>
                      <p className="text-xs font-medium mt-1">{formatCurrency(card.order_value)}</p>
                      <p className="text-[11px] text-[#7A7267] mt-1">{card.assigneeName} · {card.departmentName}</p>
                      <p className="text-[11px] text-[#7A7267]">Due {formatDate(card.expected_delivery_date)}</p>
                      <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-semibold ${HEALTH_STYLES[card.health]}`}>
                        {HEALTH_LABELS[card.health]}
                      </span>
                    </article>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      {canDrag ? (
        <p className="text-[11px] text-[#7A7267]">Drag a card to move stage. The server records history and assignment.</p>
      ) : (
        <p className="text-[11px] text-[#7A7267]">View only. Operations and admin can move stages.</p>
      )}
    </div>
  )
}
