import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}

const VARIANT_CLASSES: Record<string, string> = {
  primary: "bg-ink text-parchment hover:bg-ink/90 disabled:bg-ink/40",
  secondary:
    "bg-transparent text-ink border border-ink/20 hover:border-ink/50 disabled:opacity-40",
  ghost: "bg-transparent text-ink hover:bg-line/50 disabled:opacity-40",
  danger: "bg-rust text-white hover:bg-rust/90 disabled:bg-rust/40",
};

const SIZE_CLASSES: Record<string, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export default Button;
