import * as React from 'react'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[#10b981]/20 text-[#10b981]',
        secondary:
          'border-transparent bg-[#21262d] text-[#7d8590]',
        destructive:
          'border-transparent bg-[#f87171]/20 text-[#f87171]',
        outline:
          'border-[#21262d] text-[#7d8590]',
        positive:
          'border-transparent bg-[#34d399]/20 text-[#34d399]',
        negative:
          'border-transparent bg-[#f87171]/20 text-[#f87171]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
