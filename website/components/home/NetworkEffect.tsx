import Container from "../Container";
import SectionLabel from "../SectionLabel";
import Reveal from "../Reveal";
import Flywheel from "../Flywheel";
import StatCounter from "../StatCounter";

const stats: { value: number; suffix?: string; decimals?: number; locale?: string; label: string }[] = [
  { value: 177175, locale: "en-IN", label: "Lives Lost on Indian Roads (2024)" },
  { value: 46.2, suffix: "%", decimals: 1, label: "Two-Wheeler Fatalities" },
  { value: 12, suffix: "M+", label: "Gig Workers On The Road" },
];

export default function NetworkEffect() {
  return (
    <section className="border-b border-divider bg-bg py-28">
      <Container>
        <Reveal>
          <SectionLabel index="FLYWHEEL">The Network Effect</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-5 max-w-2xl font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
            A network that gets more powerful with every user.
          </h2>
        </Reveal>

        <div className="mt-16">
          <Flywheel />
        </div>

        <div className="mt-20 grid grid-cols-1 gap-10 border-t border-divider pt-12 sm:grid-cols-3">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08} className="text-center">
              <div className="font-mono text-2xl font-bold text-white sm:text-3xl">
                [{" "}
                <StatCounter
                  value={s.value}
                  suffix={s.suffix}
                  decimals={s.decimals ?? 0}
                  locale={s.locale}
                />{" "}
                ]
              </div>
              <div className="mt-2 font-mono text-[11px] uppercase leading-relaxed tracking-widest2 text-ink-dim">
                {s.label}
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.3} className="mt-6 font-mono text-[11px] leading-relaxed text-ink-dim/60">
          {"// Sources: MoRTH Road Accidents in India 2024 · NITI Aayog Gig Economy Report FY2024-25"}
        </Reveal>
      </Container>
    </section>
  );
}
