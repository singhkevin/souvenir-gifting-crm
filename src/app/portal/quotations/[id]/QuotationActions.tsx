'use client'

import { useState } from 'react'
import { respondToQuotation } from '../../actions'

export function QuotationActions({ quotationId }: { quotationId: string }) {
  const [loading, setLoading] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [comment, setComment] = useState('')

  const handleRespond = async (status: 'accepted' | 'rejected') => {
    if (status === 'rejected' && !rejecting) {
      setRejecting(true)
      return
    }

    setLoading(true)
    await respondToQuotation(quotationId, status, comment)
    setLoading(false)
    setRejecting(false)
  }

  return (
    <div className="mt-8 border-t border-gray-200 pt-8">
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Your Decision</h3>
      
      {rejecting ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <label className="mb-2 block text-sm font-medium text-gray-700">Reason for rejection (Optional)</label>
          <textarea 
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="mb-4 w-full rounded-md border p-2 outline-none focus:ring-[#1A3022]"
            rows={3}
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <button 
              onClick={() => handleRespond('rejected')}
              disabled={loading}
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Confirm Rejection'}
            </button>
            <button 
              onClick={() => setRejecting(false)}
              disabled={loading}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 font-semibold text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <button 
            onClick={() => handleRespond('accepted')}
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-green-600 px-6 py-2 font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Accept Quotation'}
          </button>
          <button 
            onClick={() => handleRespond('rejected')}
            disabled={loading}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-red-200 bg-white px-6 py-2 font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}
    </div>
  )
}
