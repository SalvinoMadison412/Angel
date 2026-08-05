import Container from "../Container";
import SectionLabel from "../SectionLabel";
import Reveal from "../Reveal";

const specs = [
  ["Real-time event processing", "Benchmarking in progress"],
  ["AI crash severity model", "Trained on 2M+ incident records"],
  ["Uptime SLA", "To be published"],
  ["Data sovereignty", "GDPR compliant, regional data residency"],
  ["API availability", "Partner API — latency benchmarks in progress"],
  ["Coverage", "4G LTE / 5G / Wi-Fi fallback"],
];

export default function TechInfrastructure() {
  return (
    <section className="border-b border-divider bg-bg-elevated py-28">
      <Container>
        <Reveal>
          <SectionLabel index="STACK">Technical Infrastructure</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-5 max-w-2xl font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
            Built cloud-native. Built AI-first.
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-14 grid grid-cols-1 border border-glass sm:grid-cols-2">
            {specs.map(([label, value], i) => (
              <div
                key={label}
                className={`flex items-center justify-between gap-6 border-divider p-6 ${
                  i % 2 === 0 ? "sm:border-r" : ""
                } ${i < specs.length - (specs.length % 2 === 0 ? 2 : 1) ? "border-b" : ""}`}
              >
                <span className="font-mono text-[11px] uppercase tracking-widest2 text-ink-dim">{label}</span>
                <span className="text-right font-heading text-sm font-bold text-white sm:text-base">{value}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
