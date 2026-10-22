/**
 * SV2 form input — square corners, linen fill, mono uppercase label,
 * black focus border.
 */
export function SV2Input({
  label,
  required = false,
  ...props
}: {
  label: string
  required?: boolean
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block sv2-label text-[11px] text-[#FCF9F2] mb-1 uppercase">
        {label}
        {required && ' *'}
      </label>
      <input
        className="w-full bg-[#1C1B1A] border border-[#7C766F] px-3 py-2 text-[#FCF9F2] sv2-body-sm placeholder:text-[#7C766F] focus:border-[#FF8843] focus:outline-none"
        required={required}
        {...props}
      />
    </div>
  )
}

export function SV2Select({
  label,
  required = false,
  children,
  ...props
}: {
  label: string
  required?: boolean
  children: React.ReactNode
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div>
      <label className="block sv2-label text-[11px] text-[#FCF9F2] mb-1 uppercase">
        {label}
        {required && ' *'}
      </label>
      <select
        className="w-full bg-[#1C1B1A] border border-[#7C766F] px-3 py-2 text-[#FCF9F2] sv2-body-sm focus:border-[#FF8843] focus:outline-none"
        required={required}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}

export function SV2Textarea({
  label,
  required = false,
  ...props
}: {
  label: string
  required?: boolean
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div>
      <label className="block sv2-label text-[11px] text-[#FCF9F2] mb-1 uppercase">
        {label}
        {required && ' *'}
      </label>
      <textarea
        className="w-full bg-[#1C1B1A] border border-[#7C766F] px-3 py-2 text-[#FCF9F2] sv2-body-sm placeholder:text-[#7C766F] focus:border-[#FF8843] focus:outline-none"
        required={required}
        {...props}
      />
    </div>
  )
}
