import { cn } from '@/lib/utils'

export function SkeletonShimmer({
  className,
  lines = 1,
}: {
  className?: string
  lines?: number
}) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'relative h-5 w-full overflow-hidden rounded-md bg-slate-200',
            'after:absolute after:inset-0 after:-translate-x-full after:bg-gradient-to-r after:from-transparent after:via-white/70 after:to-transparent after:animate-[shimmer_1.6s_infinite]',
            className,
          )}
        />
      ))}
    </div>
  )
}
