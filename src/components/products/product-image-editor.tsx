'use client'

import { useState } from 'react'
import { IDEMPOTENCY_FIELD, useAction, useIdempotencyKey } from '@/lib/use-action'
import { Spinner } from '@/components/ui/submit-button'
import { ProductImage } from '@/components/ui/product-image'
import { uploadProductImage, removeProductImage } from '@/app/crm/products/actions'

export function ProductImageEditor({
  productId,
  imageUrl,
  name,
}: {
  productId: string
  imageUrl: string | null
  name: string
}) {
  const { pending, run } = useAction()
  const { key, rotate } = useIdempotencyKey()
  const [which, setWhich] = useState<'upload' | 'remove' | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const onFile = (file: File | null, input?: HTMLInputElement) => {
    if (!file) return
    const started = (() => {
      setWhich('upload')
      const data = new FormData()
      data.set('product_id', productId)
      data.set('image', file)
      data.set(IDEMPOTENCY_FIELD, key)
      return run(() => uploadProductImage(data), {
        successMessage: 'Product image updated',
        onSuccess: rotate,
        onError: () => setPreview(null),
      })
    })()
    if (started) setPreview(URL.createObjectURL(file))
    if (input) input.value = ''
  }

  const onRemove = () => {
    const data = new FormData()
    data.set('product_id', productId)
    data.set(IDEMPOTENCY_FIELD, key)
    setWhich('remove')
    run(() => removeProductImage(data), {
      successMessage: 'Product image removed',
      onSuccess: () => {
        rotate()
        setPreview(null)
      },
    })
  }

  return (
    <div className="space-y-3">
      <ProductImage src={preview || imageUrl} alt={name} size="lg" className="rounded-xl border border-gray-200" />
      <div className="flex flex-wrap gap-2">
        <label className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 cursor-pointer">
          {pending && which === 'upload' ? (
            <span className="inline-flex items-center gap-2"><Spinner />Uploading…</span>
          ) : imageUrl ? 'Replace image' : 'Upload image'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={pending}
            onChange={(e) => onFile(e.target.files?.[0] || null, e.target)}
          />
        </label>
        {imageUrl && (
          <button
            type="button"
            onClick={onRemove}
            disabled={pending}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            {pending && which === 'remove' ? (
              <span className="inline-flex items-center gap-2"><Spinner />Removing…</span>
            ) : (
              'Remove'
            )}
          </button>
        )}
      </div>
      <p className="text-[11px] text-gray-400">JPG, PNG or WebP. Max 5 MB.</p>
    </div>
  )
}
