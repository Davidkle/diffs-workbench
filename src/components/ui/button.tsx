import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib";
const variants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default: "bg-violet-300 text-zinc-950 hover:bg-violet-200",
        outline: "border border-white/10 bg-white/5 hover:bg-white/10",
        ghost: "hover:bg-white/7 text-zinc-400 hover:text-zinc-100",
        destructive: "bg-red-500/15 text-red-300 hover:bg-red-500/25",
      },
      size: { default: "h-9 px-3", sm: "h-7 px-2 text-xs", icon: "size-8" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);
export function Button({
  className,
  variant,
  size,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof variants>) {
  return (
    <button className={cn(variants({ variant, size }), className)} {...props} />
  );
}
