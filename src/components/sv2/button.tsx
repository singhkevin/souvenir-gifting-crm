import Link from 'next/link'

type ButtonVariant = 'black' | 'saffron' | 'outline' | 'outline-light'

const variants: Record<ButtonVariant, string> = {
  black:
    'bg-[#000000] text-white hover:bg-[#9E4300] active:scale-[0.99]',
  saffron:
    'bg-[#9E4300] text-white hover:bg-[#FF8843] active:scale-[0.99]',
  outline:
    'border border-[#CCC5BD] text-[#1C1C18] bg-transparent hover:border-[#1C1B1A] hover:bg-[#F6F3EC]',
  'outline-light':
    'border border-[#FCF9F2] text-[#FCF9F2] bg-transparent hover:bg-[#FCF9F2] hover:text-[#1C1B1A]',
}

/**
 * SV2 Button — square corners, label-caps typography.
 * Renders as <a> when `href` is provided, otherwise <button>.
 */
export function SV2Button({
  variant = 'black',
  href,
  children,
  className = '',
  type = 'button',
  ...rest
}: {
  variant?: ButtonVariant
  href?: string
  children: React.ReactNode
  className?: string
  type?: 'button' | 'submit' | 'reset'
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement> & React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'>) {
  const classes = `inline-flex items-center justify-center px-6 py-3 sv2-label tracking-wider transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9E4300] ${variants[variant]} ${className}`

  if (href) {
    return (
      <Link href={href} className={classes} {...(rest as React.AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {children}
      </Link>
    )
  }

  return (
    <button type={type} className={classes} {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {children}
    </button>
  )
}
