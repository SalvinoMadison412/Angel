import Container from "../Container";
import Button from "../Button";
import Reveal from "../Reveal";

export default function BuyCTA() {
  return (
    <section id="buy" className="dot-grid relative overflow-hidden bg-bg py-24">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-[140px]" />
      <Container className="relative flex flex-col items-center gap-8 text-center">
        <Reveal>
          <span className="font-mono text-[11px] uppercase tracking-widest2 text-accent">[ Atom — $199 ]</span>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="max-w-lg font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
            One device. Every journey, covered.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <Button href="mailto:orders@angel.tech?subject=Atom%20Order" size="lg" icon>
            Add to Cart
          </Button>
        </Reveal>
        <Reveal delay={0.15}>
          <p className="font-mono text-[11px] uppercase tracking-widest2 text-ink-dim">
            Free Shipping — 30-Day Returns — 2-Year Warranty
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
