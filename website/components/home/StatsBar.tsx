import Container from "../Container";
import StatCounter from "../StatCounter";
import Reveal from "../Reveal";

const stats = [
  { value: 500, suffix: "K+", label: "Lives Protected" },
  { value: 100, prefix: "<", suffix: "ms", label: "Detection Time" },
  { value: 99.98, suffix: "%", decimals: 2, label: "Uptime" },
  { value: 50, suffix: "+", label: "Countries Supported" },
];

export default function StatsBar() {
  return (
    <section className="dot-grid border-b border-divider bg-bg-elevated py-20">
      <Container>
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08} className="text-center md:border-l md:border-divider md:first:border-l-0">
              <div className="font-heading text-3xl font-bold text-white sm:text-4xl">
                <StatCounter value={s.value} suffix={s.suffix} prefix={s.prefix ?? ""} decimals={s.decimals ?? 0} />
              </div>
              <div className="mt-2 font-mono text-[11px] uppercase tracking-widest2 text-ink-dim">{s.label}</div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
