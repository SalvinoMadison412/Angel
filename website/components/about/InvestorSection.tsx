import Container from "../Container";
import SectionLabel from "../SectionLabel";
import Reveal from "../Reveal";
import RequestPitchDeckButton from "../RequestPitchDeckButton";

export default function InvestorSection() {
  return (
    <section id="investors" className="dot-grid relative overflow-hidden bg-bg-elevated py-28">
      <Container className="max-w-3xl text-center">
        <Reveal>
          <SectionLabel index="INVESTORS">For Investors</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mx-auto mt-5 font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
            Angel is currently raising.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mx-auto mt-6 font-body text-base leading-relaxed text-ink-muted sm:text-lg">
            We're looking for partners who understand network-effect businesses. Angel sits at the intersection
            of hardware, embedded AI, and emergency infrastructure — a category with no incumbent doing all three
            well. We'd welcome the chance to walk you through our roadmap, unit economics, and safety validation
            data in detail.
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="mt-10 flex justify-center">
            <RequestPitchDeckButton size="lg" icon />
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
