import Container from "../Container";
import SectionLabel from "../SectionLabel";
import Reveal from "../Reveal";

function Stat({ value, label, source }: { value: string; label: string; source: string }) {
  return (
    <div className="border-t border-divider py-4 first:border-t-0 first:pt-0">
      <div className="font-mono text-xl font-bold text-white sm:text-2xl">{value}</div>
      <div className="mt-1 font-body text-xs leading-relaxed text-ink-muted">{label}</div>
      <div className="mt-1.5 font-mono text-[10px] uppercase tracking-widest2 text-ink-dim/60">
        Source: {source}
      </div>
    </div>
  );
}

const apacMarkets = [
  { flag: "🇮🇳", name: "India", stat: "260M+ two-wheelers — world's largest fleet by volume" },
  { flag: "🇻🇳", name: "Vietnam", stat: "77M+ motorcycles — 770 per 1,000 people, highest density globally" },
  { flag: "🇮🇩", name: "Indonesia", stat: "World's 2nd largest two-wheeler market by volume" },
  { flag: "🇹🇼", name: "Taiwan", stat: "Among world's highest motorcycle-per-capita ratios" },
  { flag: "🇹🇭", name: "Thailand", stat: "Motorcycle taxis a primary urban transport layer" },
  { flag: "🇵🇭", name: "Philippines", stat: "\"Habal-habal\" motorcycle taxis fundamental to mobility" },
];

export default function WhyNow() {
  return (
    <section className="border-b border-divider bg-bg py-28">
      <Container>
        <Reveal>
          <SectionLabel index="06">The Market</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-5 max-w-2xl font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
            A market we can size from the ground up — not a headline number.
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden border border-glass bg-divider md:grid-cols-3">
          {/* Layer 1 — India */}
          <Reveal>
            <div className="flex h-full flex-col bg-bg p-8">
              <span className="font-mono text-xs text-accent">[ PHASE 1 ]</span>
              <h3 className="mt-3 font-heading text-lg font-bold text-white">India</h3>

              <div className="mt-2">
                <Stat value="260M+" label="Registered two-wheelers in India" source="Data for India / MoRTH" />
                <Stat
                  value="12M → 23.5M"
                  label="Gig workers on Indian roads today, growing by 2030"
                  source="NITI Aayog FY 2024-25"
                />
                <Stat
                  value="₹1.40B → ₹4.35B"
                  label="India's vehicle telematics & safety market by 2030, at a 25.41% CAGR — the infrastructure is being built now"
                  source="MarqStats / Industry reports 2025"
                />
              </div>

              <p className="mt-5 font-body text-sm leading-relaxed text-ink-muted">
                Angel's immediate market is India's 12 million gig workers — delivery riders and cab drivers who
                spend more hours on Indian roads than anyone else, with no crash detection and no guaranteed
                emergency response when something goes wrong.
              </p>
            </div>
          </Reveal>

          {/* Layer 2 — APAC Expansion */}
          <Reveal delay={0.08}>
            <div className="flex h-full flex-col bg-bg p-8">
              <span className="font-mono text-xs text-accent">[ PHASE 2 ]</span>
              <h3 className="mt-3 font-heading text-lg font-bold text-white">APAC Expansion</h3>

              <div className="mt-5 grid grid-cols-1 gap-3">
                {apacMarkets.map((m) => (
                  <div key={m.name} className="flex items-start gap-3">
                    <span className="text-base leading-none">{m.flag}</span>
                    <div>
                      <span className="font-heading text-sm font-bold text-white">{m.name}</span>
                      <p className="mt-0.5 font-body text-xs leading-relaxed text-ink-muted">{m.stat}</p>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-5 font-body text-sm leading-relaxed text-ink-muted">
                In all six markets, two-wheelers are not a lifestyle — they are the economy. Gig workers,
                delivery fleets, and daily commuters face the same problem Angel solves. No connected safety
                layer exists for any of them.
              </p>

              <p className="mt-4 font-mono text-[10px] uppercase tracking-widest2 text-ink-dim/60">
                Source: autopunditz.com (May 2026) · Vietnam National Traffic Safety Committee · ICCT Global
                Two-Wheeler Report 2025
              </p>
            </div>
          </Reveal>

          {/* Layer 3 — Telematics Wave */}
          <Reveal delay={0.16}>
            <div className="flex h-full flex-col bg-bg p-8">
              <span className="font-mono text-xs text-accent">[ PHASE 3 ]</span>
              <h3 className="mt-3 font-heading text-lg font-bold text-white">The Telematics Wave</h3>

              <div className="mt-2">
                <Stat
                  value="$110.6B → $158.2B"
                  label="Asia-Pacific two-wheeler market, 2024 to 2034"
                  source="Global Market Insights 2024"
                />
                <Stat
                  value="$34.6B · 14.1% CAGR"
                  label="Global automotive telematics market, 2024 — India is one of the fastest-growing segments"
                  source="GMInsights 2025"
                />
              </div>

              <p className="mt-5 font-body text-sm leading-relaxed text-ink-muted">
                Angel is not betting on a new behaviour. It is positioning on top of a regulatory and
                infrastructure shift already underway — governments across Asia are mandating connected vehicle
                safety. Angel is building the two-wheeler layer that no one has built yet.
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal
          delay={0.2}
          className="mt-6 font-mono text-[11px] leading-relaxed text-ink-dim/60"
        >
          {"// Sources: MoRTH Road Accidents in India 2024 · NITI Aayog Gig Economy Report FY2024-25 · MarqStats India Telematics Market 2025 · autopunditz.com (May 2026) · Vietnam National Traffic Safety Committee · ICCT Global Two-Wheeler Report 2025 · Global Market Insights APAC Two-Wheeler Report 2024 · GMInsights Automotive Telematics Market 2025"}
        </Reveal>
      </Container>
    </section>
  );
}
