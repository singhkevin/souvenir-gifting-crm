'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { autoMapHeaders, parseCsv } from '@/lib/csv'
import { importCatalogueCsv, type ImportSummary } from './import-actions'
import { MobileSheetSelect } from '@/components/ui/mobile-filter-sheet'

const FIELD_LABELS: { key: string; label: string; required?: boolean }[] = [
  { key: 'name', label: 'Product name', required: true },
  { key: 'sku', label: 'SKU', required: true },
  { key: 'price', label: 'Price', required: true },
  { key: 'description', label: 'Description' },
  { key: 'category', label: 'Category' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'moq', label: 'MOQ' },
  { key: 'supplier_cost', label: 'Supplier cost' },
  { key: 'hsn_code', label: 'HSN' },
  { key: 'image_url', label: 'Image URL' },
  { key: 'image_filename', label: 'Image filename' },
  { key: 'catalogue_access', label: 'Visibility (all / selected / none)' },
  { key: 'companies', label: 'Companies (semicolon-separated names)' },
  { key: 'colour', label: 'Colour' },
  { key: 'size', label: 'Size' },
  { key: 'gender', label: 'Gender' },
  { key: 'material', label: 'Material' },
  { key: 'status', label: 'Status' },
]

export function CatalogueCsvImporter() {
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [preview, setPreview] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [images, setImages] = useState<File[]>([])
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [pending, startTransition] = useTransition()

  const mappedRequired = useMemo(
    () => FIELD_LABELS.filter((f) => f.required).every((f) => mapping[f.key]),
    [mapping],
  )

  const onCsv = async (file: File | null) => {
    setSummary(null)
    setCsvFile(file)
    if (!file) {
      setHeaders([])
      setPreview([])
      setMapping({})
      return
    }
    const table = parseCsv(await file.text())
    setHeaders(table.headers)
    setPreview(table.rows.slice(0, 5))
    setMapping(autoMapHeaders(table.headers))
  }

  const onImport = () => {
    if (!csvFile) {
      toast.error('Choose a CSV file to import')
      return
    }
    if (!mappedRequired) {
      toast.error('Map product name, SKU and price before importing')
      return
    }
    const data = new FormData()
    data.set('csv', csvFile)
    data.set('mapping', JSON.stringify(mapping))
    images.forEach((image) => data.append('images', image))
    startTransition(async () => {
      const result = await importCatalogueCsv(data)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      setSummary(result)
      if (result.imported > 0) toast.success(`${result.imported} products imported`)
      if (result.failed > 0) toast.error(`${result.failed} rows failed`)
    })
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-gray-200 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">CSV file</label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => void onCsv(e.target.files?.[0] || null)}
            className="text-xs file:mr-2 file:px-3 file:py-1.5 file:rounded-md file:border file:border-gray-200 file:bg-white file:text-xs"
          />
          <p className="text-[11px] text-gray-500 mt-2">
            Required columns: product name, SKU, price. Optional: description, category, supplier, MOQ,
            visibility, companies, image_url, image_filename, colour, size.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1.5">Product photos (optional)</label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={(e) => setImages(Array.from(e.target.files || []))}
            className="text-xs file:mr-2 file:px-3 file:py-1.5 file:rounded-md file:border file:border-gray-200 file:bg-white file:text-xs"
          />
          <p className="text-[11px] text-gray-500 mt-2">
            Match files to the CSV <span className="font-mono">image_filename</span> column. Public
            <span className="font-mono"> image_url</span> values are stored as-is.
          </p>
          {images.length > 0 && (
            <p className="text-[11px] text-gray-600 mt-1">{images.length} image{images.length === 1 ? '' : 's'} ready to match</p>
          )}
        </div>
      </div>

      {headers.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 space-y-4">
          <h2 className="text-sm font-bold text-gray-900">Column mapping</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {FIELD_LABELS.map((field) => (
              <MobileSheetSelect
                key={field.key}
                label={`${field.label}${field.required ? ' *' : ''}`}
                showDesktopLabel
                value={mapping[field.key] || ''}
                onChange={(next) => setMapping((prev) => ({ ...prev, [field.key]: next }))}
                emptyLabel="Ignore"
                options={[
                  { value: '', label: 'Ignore' },
                  ...headers.map((header) => ({ value: header, label: header })),
                ]}
              />
            ))}
          </div>

          {preview.length > 0 && (
            <div className="overflow-x-auto border border-gray-100 rounded-lg">
              <table className="w-full text-[11px]">
                <thead className="bg-gray-50">
                  <tr>
                    {headers.map((header) => (
                      <th key={header} className="text-left px-2 py-2 font-semibold text-gray-500 whitespace-nowrap">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      {headers.map((_, col) => (
                        <td key={col} className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{row[col] || ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            type="button"
            disabled={pending || !mappedRequired}
            onClick={onImport}
            className="px-6 py-2 text-xs font-semibold text-white bg-[#4A235A] hover:bg-[#3d1c4a] rounded-lg disabled:opacity-50"
          >
            {pending ? 'Importing…' : 'Import products'}
          </button>
        </div>
      )}

      {summary && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 space-y-3">
          <h2 className="text-sm font-bold text-gray-900">Import summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <SummaryStat label="Total rows" value={summary.total} />
            <SummaryStat label="Imported" value={summary.imported} />
            <SummaryStat label="Skipped" value={summary.skipped} />
            <SummaryStat label="Failed" value={summary.failed} />
          </div>
          {summary.failures.length > 0 && (
            <ul className="text-xs text-red-700 space-y-1">
              {summary.failures.slice(0, 50).map((failure) => (
                <li key={`${failure.row}-${failure.sku}`}>
                  Row {failure.row} ({failure.sku}): {failure.reason}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
      <p className="text-[10px] uppercase font-semibold text-gray-400">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
    </div>
  )
}
