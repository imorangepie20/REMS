import { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  glow?: boolean
  fullWidth?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
}

const variants: Record<string, string> = {
  primary: 'bg-hud-accent-primary text-hud-on-accent hover:bg-hud-accent-primary/90',
  secondary: 'bg-hud-accent-info text-hud-on-accent hover:bg-hud-accent-info/90',
  outline: 'border border-hud-accent-primary text-hud-accent-primary hover:bg-hud-accent-primary/10',
  ghost: 'text-hud-text-secondary hover:bg-hud-bg-hover hover:text-hud-text-primary',
  danger: 'bg-hud-accent-danger text-hud-on-accent hover:bg-hud-accent-danger/90',
}

const sizes: Record<string, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-6 py-3 text-base gap-2',
}

export default function Button({
  children, variant = 'primary', size = 'md',
  glow = false, fullWidth = false,
  leftIcon, rightIcon, className = '', ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-medium rounded-lg transition-hud disabled:opacity-50 disabled:cursor-not-allowed'
  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${glow ? 'btn-glow' : ''} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {leftIcon && <span>{leftIcon}</span>}
      {children}
      {rightIcon && <span>{rightIcon}</span>}
    </button>
  )
}
