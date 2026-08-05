import Container from "../Container";
import Button from "../Button";
import Reveal from "../Reveal";

export default function CTABanner() {
  return (
    <section className="dot-grid relative overflow-hidden bg-bg py-28">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-[140px]" />
      <Container className="relative text-center">
        <Reveal>
          <span className="font-mono text-[11px] uppercase tracking-widest2 text-accent">[ Join The Network ]</span>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mx-auto mt-5 max-w-2xl font-heading text-3xl font-bold leading-tight text-white sm:text-5xl">
            Join the network that's redefining how the world responds to road emergencies.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
            <Button href="/network" size="lg" icon>
              Partner with Angel
            </Button>
            <Button href="/product" variant="secondary" size="lg">
              Buy Atom
            </Button>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
