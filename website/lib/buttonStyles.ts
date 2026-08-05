export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "md" | "lg";

const base =
  "group inline-flex items-center justify-center gap-2 font-mono font-bold uppercase tracking-widest2 transition-colors duration-100 border";

const sizes: Record<ButtonSize, string> = {
  md: "px-6 py-3 text-xs",
  lg: "px-8 py-4 text-sm",
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent border-accent text-white hover:bg-accent-hover hover:border-accent-hover animate-glow-pulse",
  secondary: "bg-transparent border-glass text-white hover:border-accent hover:text-accent",
  ghost: "bg-transparent border-transparent text-white hover:text-accent",
};

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md", className = "") {
  return `${base} ${sizes[size]} ${variants[variant]} ${className}`;
}
