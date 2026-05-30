import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "./utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-xs font-mono font-bold uppercase tracking-widest transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-aic-gold disabled:pointer-events-none disabled:opacity-50 active:scale-95",
  {
    variants: {
      variant: {
        default: "bg-aic-black text-aic-paper hover:bg-aic-gold hover:text-black shadow-xl",
        destructive: "bg-aic-red text-aic-paper hover:bg-red-600 shadow-xl",
        outline: "border border-aic-black/10 bg-transparent hover:bg-aic-paper hover:text-aic-black",
        secondary: "bg-aic-paper text-aic-black hover:bg-aic-black/5",
        ghost: "hover:bg-aic-paper hover:text-aic-black",
        link: "text-aic-black underline-offset-4 hover:underline",
        institutional: "bg-[#080808] text-aic-gold border border-aic-gold/20 hover:bg-aic-gold hover:text-black",
      },
      size: {
        default: "h-12 px-8 py-4",
        sm: "h-9 px-4",
        lg: "h-14 px-10",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const InstitutionalButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
InstitutionalButton.displayName = "InstitutionalButton"

export { InstitutionalButton, buttonVariants }
