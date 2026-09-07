'use client'

import { useEffect, useState } from 'react'
import { ProductImage } from '@/components/ui/product-image'

const ALLOWED = ['image/png', 'image/jpeg', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

export function ProductImageField() {
  const [preview, setPreview] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const onChange = (file: File | null) => {
    if (preview) URL.revokeObjectURL(preview)
    setPreview(null)
    setFileName('')
    setError('')
    if (!file) return
    if (!ALLOWED.includes(file.type)) {
      setError('Please upload a JPG, PNG or WebP image.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('Please upload an image smaller than 5 MB.')
      return
    }
    setFileName(file.name)
    setPreview(URL.createObjectURL(file))
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-semibold text-gray-700">Product photo</label>
      <div className="flex flex-col sm:flex-row gap-4 items-start">
        <div className="w-36 h-36 rounded-xl overflow-hidden border border-gray-200 bg-[#FAF7F2] flex-shrink-0">
          <ProductImage src={preview} alt={fileName || 'Product photo preview'} size="lg" className="w-full h-full rounded-xl" />
        </div>
        <div className="space-y-2">
          <input
            type="file"
            name="image"
            accept="image/png,image/jpeg,image/webp"
            className="text-xs file:mr-2 file:px-3 file:py-1.5 file:rounded-md file:border file:border-gray-200 file:bg-white file:text-xs"
            onChange={(e) => onChange(e.target.files?.[0] || null)}
          />
          <p className="text-[11px] text-gray-500">
            JPG, PNG or WebP · max 5 MB. Upload a studio-style photo of this exact product. Stored in the existing
            product-images bucket.
          </p>
          {fileName && !error && <p className="text-[11px] text-gray-600">Selected: {fileName}</p>}
          {error && <p className="text-[11px] text-red-600">{error}</p>}
          <p className="text-[11px] text-gray-400">
            If you skip a photo now, you can add one from the product page after saving.
          </p>
        </div>
      </div>
    </div>
  )
}
