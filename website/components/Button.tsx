import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnchorHTMLAttributes } from "react";

type ButtonProps = {
  href: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "lg";
  icon?: boolean;
  className?: string;
  children: React.ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

export default function Button({
  href,
  variant = "primary",
  size = "md",
  icon = false,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const base =
    "group inline-flex items-center justify-center gap-2 font-mono font-bold uppercase tracking-widest2 transition-colors duration-100 border";
  const sizes = size === "lg" ? "px-8 py-4 text-sm" : "px-6 py-3 text-xs";
  const variants = {
    primary: "bg-accent border-accent text-white hover:bg-accent-hover hover:border-accent-hover",
    secondary: "bg-transparent border-glass text-white hover:border-accent hover:text-accent",
    ghost: "bg-transparent border-transparent text-white hover:text-accent",
  };

  const isExternal = href.startsWith("http") || href.startsWith("mailto:");

  const content = (
    <>
      {children}
      {icon && <ArrowRight size={14} className="transition-transform duration-100 group-hover:translate-x-1" />}
    </>
  );

  if (isExternal) {
    return (
      <a href={href} className={`${base} ${sizes} ${variants[variant]} ${className}`} {...rest}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={`${base} ${sizes} ${variants[variant]} ${className}`}>
      {content}
    </Link>
  );
}
