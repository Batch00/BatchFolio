import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-[#21262d]', className)}
      {...props}
    />
  )
}

export { Skeleton }
