import Link from "next/link";
import { Twitter, Linkedin, Instagram } from "lucide-react";
import Logo from "./Logo";
import Container from "./Container";

const columns = [
  {
    title: "Platform",
    links: [
      { href: "/network", label: "Network" },
      { href: "/product", label: "Atom" },
      { href: "/product#specs", label: "Tech Specs" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/about#investors", label: "Investors" },
      { href: "/network#partners", label: "Partners" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/terms", label: "Terms" },
      { href: "/contact", label: "Support" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-divider bg-bg-elevated">
      <Container className="py-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <Logo className="h-7 w-7" />
              <span className="font-heading-mono text-[15px] font-bold tracking-widest2 text-white">ANGEL</span>
            </Link>
            <p className="mt-4 max-w-xs font-body text-sm leading-relaxed text-ink-muted">
              The infrastructure layer for road safety — a two-sided network connecting drivers with the
              responders, fleets, and hospitals that reach them.
            </p>
            <div className="mt-6 flex items-center gap-4">
              {[Twitter, Linkedin, Instagram].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="flex h-9 w-9 items-center justify-center border border-glass text-ink-muted transition-colors hover:border-accent hover:text-accent"
                  aria-label="Social link"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="font-mono text-[11px] uppercase tracking-widest2 text-ink-dim">{col.title}</h4>
              <ul className="mt-4 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link href={link.href} className="font-body text-sm text-ink-muted hover:text-white">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-divider pt-8 font-mono text-[11px] uppercase tracking-widest2 text-ink-dim md:flex-row">
          <span>© 2026 Angel Technologies. All rights reserved.</span>
          <span>[ Designed for the roads ahead ]</span>
        </div>
      </Container>
    </footer>
  );
}
