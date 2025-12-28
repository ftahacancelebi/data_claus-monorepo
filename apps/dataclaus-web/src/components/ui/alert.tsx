import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { Warning, CheckCircle, Info, XCircle } from "phosphor-react"

const alertVariants = cva(
  "relative w-full rounded-xl border p-4 backdrop-blur-sm transition-all",
  {
    variants: {
      variant: {
        default: "bg-slate-50/80 border-slate-200 text-slate-800",
        destructive: "bg-red-50/80 border-red-200/50 text-red-800",
        success: "bg-emerald-50/80 border-emerald-200/50 text-emerald-800",
        warning: "bg-amber-50/80 border-amber-200/50 text-amber-800",
        info: "bg-blue-50/80 border-blue-200/50 text-blue-800",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const iconMap = {
  default: Info,
  destructive: XCircle,
  success: CheckCircle,
  warning: Warning,
  info: Info,
}

const iconColorMap = {
  default: "text-slate-500",
  destructive: "text-red-500",
  success: "text-emerald-500",
  warning: "text-amber-500",
  info: "text-blue-500",
}

interface AlertProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {
  showIcon?: boolean;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", showIcon = true, children, ...props }, ref) => {
    const Icon = iconMap[variant || "default"];
    const iconColor = iconColorMap[variant || "default"];
    
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(alertVariants({ variant }), className)}
        {...props}
      >
        <div className="flex gap-3">
          {showIcon && (
            <Icon size={20} weight="duotone" className={cn("flex-shrink-0 mt-0.5", iconColor)} />
          )}
          <div className="flex-1">{children}</div>
        </div>
      </div>
    )
  }
)
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("mt-1 text-sm opacity-90 leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription }
