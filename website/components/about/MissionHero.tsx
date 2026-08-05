import Container from "../Container";
import SectionLabel from "../SectionLabel";
import Reveal from "../Reveal";

export default function MissionHero() {
  return (
    <section className="dot-grid-faint fade-mask-b relative border-b border-divider pt-[72px]">
      <Container className="py-24 lg:py-32">
        <Reveal>
          <SectionLabel index="ABOUT">Our Mission</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="mt-6 max-w-3xl font-heading text-4xl font-bold leading-[1.1] text-white sm:text-5xl lg:text-6xl">
            We're not building a safety product. We're building the infrastructure layer beneath it.
          </h1>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mt-10 grid max-w-3xl grid-cols-1 gap-6 font-body text-base leading-relaxed text-ink-muted sm:text-lg md:grid-cols-2">
            <p>
              Angel started with a question our founders couldn't stop asking after a close friend was seriously
              injured in a highway collision: why does help still depend on someone conscious enough to call for
              it? Emergency response has barely changed in fifty years, while the vehicles it protects have
              transformed completely.
            </p>
            <p>
              We're a team of hardware engineers, safety researchers, and former emergency dispatch operators
              building the network that should have existed all along — one where drivers, responders, tow
              fleets, hospitals, and insurers are already connected before a crash ever happens.
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
