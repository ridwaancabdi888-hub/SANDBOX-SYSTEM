import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
type Size = "sm" | "md" | "lg" | "xl";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500 shadow-sm",
  secondary:
    "bg-ink-900 text-background hover:opacity-90 focus-visible:ring-brand-400 shadow-sm",
  outline:
    "border border-border bg-card hover:bg-muted text-foreground focus-visible:ring-brand-400",
  ghost: "hover:bg-muted text-foreground focus-visible:ring-brand-400",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500 shadow-sm",
  success:
    "bg-green-600 text-white hover:bg-green-700 focus-visible:ring-green-500 shadow-sm",
};

const sizeClasses: Record<Size, string> = {
  // `touch:` bumps the tap area to 44px on coarse pointers only — a mouse
  // keeps the denser desktop sizing.
  sm: "h-8 px-3 text-sm gap-1.5 touch:min-h-11 touch:px-4",
  md: "h-10 px-4 text-sm gap-2 touch:min-h-11",
  lg: "h-12 px-6 text-base gap-2",
  xl: "h-16 px-8 text-lg gap-3",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, disabled, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center rounded-lg font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:pointer-events-none",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
