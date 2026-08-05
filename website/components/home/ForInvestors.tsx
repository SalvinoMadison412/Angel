import { Cpu, Building2, Database } from "lucide-react";
import Container from "../Container";
import SectionLabel from "../SectionLabel";
import Reveal from "../Reveal";
import RequestPitchDeckButton from "../RequestPitchDeckButton";

const revenue = [
  {
    icon: Cpu,
    n: "01",
    title: "Hardware",
    body: "Atom device sales. A one-time purchase that functions as our primary user acquisition channel — every unit sold is a new node on the network.",
  },
  {
    icon: Building2,
    n: "02",
    title: "B2B SaaS",
    body: "Partner subscription fees paid by EMS providers, tow fleets, hospitals, and insurers for access to verified, real-time incident demand. Recurring, high-margin.",
  },
  {
    icon: Database,
    n: "03",
    title: "Data & APIs",
    body: "Telematics and incident data licensing to insurers and municipalities — an institutional revenue stream built on a dataset no competitor can replicate.",
  },
];

export default function ForInvestors() {
  return (
    <section className="dot-grid border-b border-divider bg-bg-elevated py-28">
      <Container>
        <Reveal>
          <SectionLabel index="07">For Investors</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-5 max-w-2xl font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
            Building the rails of road safety.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-6 max-w-2xl font-body text-base leading-relaxed text-ink-muted">
            India loses 1,77,175 lives to road accidents annually. 30–40% of those deaths happen in the first
            hour — the window where Angel operates. We are not selling safety theatre. We are building the
            infrastructure that plugs the response gap, starting with the 12 million gig workers who face this
            risk every single day with no protection.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden border border-glass bg-divider md:grid-cols-3">
          {revenue.map((r, i) => (
            <Reveal key={r.title} delay={i * 0.08}>
              <div className="h-full bg-bg-elevated p-8">
                <span className="font-mono text-xs text-accent">[ {r.n} ]</span>
                <r.icon size={22} strokeWidth={1.5} className="mt-4 text-accent" />
                <h3 className="mt-4 font-heading text-lg font-bold text-white">{r.title}</h3>
                <p className="mt-3 font-body text-sm leading-relaxed text-ink-muted">{r.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.15} className="mt-14 flex justify-center">
          <RequestPitchDeckButton size="lg" icon />
        </Reveal>
      </Container>
    </section>
  );
}
