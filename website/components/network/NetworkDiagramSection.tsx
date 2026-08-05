import Container from "../Container";
import SectionLabel from "../SectionLabel";
import Reveal from "../Reveal";
import NetworkDiagram from "../NetworkDiagram";

export default function NetworkDiagramSection() {
  return (
    <section className="border-b border-divider bg-bg-elevated py-24">
      <Container>
        <Reveal>
          <SectionLabel index="MAP">The Live Network</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-5 max-w-2xl font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
            Drivers and partners, connected through one infrastructure hub.
          </h2>
        </Reveal>

        <Reveal delay={0.1} className="mt-14">
          <div className="bracket-corner border border-glass bg-glass-fill p-6 sm:p-10">
            <NetworkDiagram variant="full" className="w-full" />
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
