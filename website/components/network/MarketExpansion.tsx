import Container from "../Container";
import SectionLabel from "../SectionLabel";
import Reveal from "../Reveal";

type Row = {
  market: string;
  population: string;
  useCase: string;
  status: "live" | "target";
  statusLabel: string;
};

const rows: Row[] = [
  {
    market: "India",
    population: "260M+",
    useCase: "Gig delivery + daily commute",
    status: "live",
    statusLabel: "LIVE — PHASE 1",
  },
  {
    market: "Vietnam",
    population: "77M+",
    useCase: "Daily commute + gig delivery",
    status: "target",
    statusLabel: "PHASE 2 TARGET",
  },
  {
    market: "Indonesia",
    population: "90M+",
    useCase: "Urban mobility + logistics",
    status: "target",
    statusLabel: "PHASE 2 TARGET",
  },
  {
    market: "Taiwan",
    population: "High per-capita density",
    useCase: "Urban commute",
    status: "target",
    statusLabel: "PHASE 2 TARGET",
  },
  {
    market: "Thailand",
    population: "22M+",
    useCase: "Motorcycle taxis + delivery",
    status: "target",
    statusLabel: "PHASE 2 TARGET",
  },
  {
    market: "Philippines",
    population: "14M+",
    useCase: "Habal-habal + gig economy",
    status: "target",
    statusLabel: "PHASE 2 TARGET",
  },
];

function StatusBadge({ row }: { row: Row }) {
  if (row.status === "live") {
    return (
      <span className="inline-flex items-center border border-accent-border bg-accent/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest2 text-accent">
        [ {row.statusLabel} ]
      </span>
    );
  }
  return (
    <span className="inline-flex items-center border border-glass px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest2 text-ink-muted">
      [ {row.statusLabel} ]
    </span>
  );
}

export default function MarketExpansion() {
  return (
    <section className="border-b border-divider bg-bg py-28">
      <Container>
        <Reveal>
          <SectionLabel index="EXPANSION">Where We're Going</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-5 max-w-2xl font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
            The same problem, repeated across six markets.
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-14 overflow-x-auto border border-glass">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-[1fr_1fr_1.4fr_1.1fr] border-b border-divider bg-glass-fill">
                {["Market", "Two-Wheeler Population", "Primary Use Case", "Status"].map((h) => (
                  <div key={h} className="p-4 font-mono text-[11px] uppercase tracking-widest2 text-ink-dim">
                    {h}
                  </div>
                ))}
              </div>
              {rows.map((row, i) => (
                <div
                  key={row.market}
                  className={`grid grid-cols-[1fr_1fr_1.4fr_1.1fr] items-center ${
                    i < rows.length - 1 ? "border-b border-divider" : ""
                  }`}
                >
                  <div className="p-4 font-heading text-sm font-bold text-white">{row.market}</div>
                  <div className="p-4 font-mono text-sm text-ink-muted">{row.population}</div>
                  <div className="p-4 font-body text-sm text-ink-muted">{row.useCase}</div>
                  <div className="p-4">
                    <StatusBadge row={row} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.15}>
          <p className="mt-8 max-w-2xl font-body text-sm leading-relaxed text-ink-muted">
            Common thread across all Phase 2 markets: two-wheelers are primary economic infrastructure, gig
            platforms are active, and connected safety is absent.
          </p>
        </Reveal>

        <Reveal delay={0.2} className="mt-6 font-mono text-[11px] leading-relaxed text-ink-dim/60">
          {"// Sources: autopunditz.com (May 2026) · Vietnam National Traffic Safety Committee · ICCT Global Two-Wheeler Report 2025"}
        </Reveal>
      </Container>
    </section>
  );
}
