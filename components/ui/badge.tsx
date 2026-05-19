import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30",
        secondary:
          "bg-white/[0.07] text-white/60 border border-white/[0.1]",
        destructive:
          "bg-red-500/15 text-red-400 border border-red-500/25",
        outline:
          "border border-white/20 text-white/60",
        success:
          "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
        warning:
          "bg-amber-500/15 text-amber-400 border border-amber-500/25",
        purple:
          "bg-violet-500/15 text-violet-400 border border-violet-500/25",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
