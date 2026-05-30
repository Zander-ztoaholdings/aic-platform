import * as React from "react"
import { cn } from "./utils"

const InstitutionalCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-[2.5rem] border border-aic-black/5 bg-aic-paper text-aic-black shadow-xl",
      className
    )}
    {...props}
  />
))
InstitutionalCard.displayName = "InstitutionalCard"

const InstitutionalCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-10", className)}
    {...props}
  />
))
InstitutionalCardHeader.displayName = "InstitutionalCardHeader"

const InstitutionalCardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-xs md:text-sm font-mono font-bold text-aic-gold uppercase tracking-[0.2em]",
      className
    )}
    {...props}
  />
))
InstitutionalCardTitle.displayName = "InstitutionalCardTitle"

const InstitutionalCardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm md:text-base font-serif italic text-gray-500", className)}
    {...props}
  />
))
InstitutionalCardDescription.displayName = "InstitutionalCardDescription"

const InstitutionalCardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-10 pt-0", className)} {...props} />
))
InstitutionalCardContent.displayName = "InstitutionalCardContent"

const InstitutionalCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-10 pt-0", className)}
    {...props}
  />
))
InstitutionalCardFooter.displayName = "InstitutionalCardFooter"

export {
  InstitutionalCard,
  InstitutionalCardHeader,
  InstitutionalCardFooter,
  InstitutionalCardTitle,
  InstitutionalCardDescription,
  InstitutionalCardContent,
}
