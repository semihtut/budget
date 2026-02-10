import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "success" | "danger" | "ghost";
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles = {
  primary:
    "bg-blue-500 active:bg-blue-600 disabled:bg-slate-600 text-white",
  success:
    "bg-green-500 active:bg-green-600 disabled:bg-green-800 text-white",
  danger:
    "bg-red-500 active:bg-red-600 disabled:bg-red-800 text-white",
  ghost:
    "bg-slate-800 active:bg-slate-700 disabled:bg-slate-800 text-slate-200",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", loading, icon, children, className = "", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`w-full rounded-xl py-4 text-lg font-semibold transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900
          disabled:cursor-not-allowed disabled:opacity-50
          ${variantStyles[variant]} ${className}`}
        {...props}
      >
        <span className="flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : icon}
          {children}
        </span>
      </button>
    );
  },
);

Button.displayName = "Button";
export default Button;
