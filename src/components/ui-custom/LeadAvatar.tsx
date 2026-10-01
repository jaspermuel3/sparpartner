import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

const PALETTE = [
  'bg-sky-100 text-sky-700 border-sky-200',
  'bg-emerald-100 text-emerald-700 border-emerald-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-lime-100 text-lime-700 border-lime-200',
  'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
  'bg-slate-100 text-slate-700 border-slate-200',
]

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export function LeadAvatar({
  firstName,
  lastName,
  size = 'md',
  className,
}: {
  firstName: string | null | undefined
  lastName: string | null | undefined
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const fn = firstName ?? ''
  const ln = lastName ?? ''
  const initials = `${fn.slice(0, 1)}${ln.slice(0, 1)}`.toUpperCase() || '??'
  const paletteClass = PALETTE[hashString(`${fn} ${ln}`) % PALETTE.length]
  const sizeClass =
    size === 'sm' ? 'h-7 w-7 text-[11px]' : size === 'lg' ? 'h-11 w-11 text-sm' : 'h-8 w-8 text-xs'

  return (
    <Avatar className={cn('shrink-0 border', sizeClass, paletteClass, className)}>
      <AvatarFallback className={cn('font-semibold tracking-wide', paletteClass)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}
