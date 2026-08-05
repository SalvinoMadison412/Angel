import Container from "./Container";
import SectionLabel from "./SectionLabel";
import StatCounter from "./StatCounter";
import Reveal from "./Reveal";

export type StatItem = {
  value: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
  locale?: string;
  label: string;
  source?: string;
};

export default function StatsBand({
  stats,
  sectionIndex,
  sectionTitle,
  footnote,
}: {
  stats: StatItem[];
  sectionIndex?: string;
  sectionTitle?: string;
  footnote?: string;
}) {
  return (
    <section className="dot-grid border-b border-divider bg-bg-elevated py-20">
      <Container>
        {sectionIndex && sectionTitle && (
          <Reveal className="mb-10">
            <SectionLabel index={sectionIndex}>{sectionTitle}</SectionLabel>
          </Reveal>
        )}

        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal
              key={s.label}
              delay={i * 0.08}
              className="text-center md:border-l md:border-divider md:first:border-l-0"
            >
              <div className="font-heading text-3xl font-bold text-white sm:text-4xl">
                <StatCounter
                  value={s.value}
                  suffix={s.suffix}
                  prefix={s.prefix ?? ""}
                  decimals={s.decimals ?? 0}
                  locale={s.locale}
                />
              </div>
              <div className="mt-2 font-mono text-[11px] uppercase leading-relaxed tracking-widest2 text-ink-dim">
                {s.label}
              </div>
              {s.source && (
                <div className="mt-1.5 font-mono text-[9px] uppercase tracking-widest2 text-ink-dim/60">
                  Source: {s.source}
                </div>
              )}
            </Reveal>
          ))}
        </div>

        {footnote && (
          <Reveal delay={0.2} className="mt-10 font-mono text-[11px] leading-relaxed text-ink-dim/60">
            {footnote}
          </Reveal>
        )}
      </Container>
    </section>
  );
}
