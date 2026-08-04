import Container from "../Container";
import Button from "../Button";
import Reveal from "../Reveal";

export default function CTABanner() {
  return (
    <section className="dot-grid relative overflow-hidden bg-bg py-28">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-[140px]" />
      <Container className="relative text-center">
        <Reveal>
          <span className="font-mono text-[11px] uppercase tracking-widest2 text-accent">[ Get Started ]</span>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mx-auto mt-5 max-w-2xl font-heading text-3xl font-bold leading-tight text-white sm:text-5xl">
            Ready to protect every journey?
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-5 max-w-lg font-body text-base text-ink-muted">
            AGL v1 ships in 3–5 business days. No subscription required to start protecting the people who ride
            with you.
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="mt-10 flex justify-center">
            <Button href="/product" size="lg" icon>
              Get AGL v1
            </Button>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
