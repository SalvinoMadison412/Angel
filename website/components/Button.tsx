import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnchorHTMLAttributes } from "react";
import { buttonClasses, ButtonVariant, ButtonSize } from "@/lib/buttonStyles";

type ButtonProps = {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
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
  const isExternal = href.startsWith("http") || href.startsWith("mailto:");

  const content = (
    <>
      {children}
      {icon && <ArrowRight size={14} className="transition-transform duration-100 group-hover:translate-x-1" />}
    </>
  );

  if (isExternal) {
    return (
      <a href={href} className={buttonClasses(variant, size, className)} {...rest}>
        {content}
      </a>
    );
  }

  return (
    <Link href={href} className={buttonClasses(variant, size, className)}>
      {content}
    </Link>
  );
}
