import { Users, Building2, Database } from "lucide-react";
import Container from "../Container";
import SectionLabel from "../SectionLabel";
import Reveal from "../Reveal";

const columns = [
  {
    icon: Users,
    n: "01",
    title: "User Growth",
    body: "Every Atom sold is one new network node. Hardware is the user acquisition channel — not the product itself.",
  },
  {
    icon: Building2,
    n: "02",
    title: "Partner Growth",
    body: "More verified incidents mean more partner ROI, which means more partners joining, which means better coverage for users.",
  },
  {
    icon: Database,
    n: "03",
    title: "Data Moat",
    body: "Every incident generates proprietary crash, location, response-time, and outcome data — a dataset no competitor can replicate.",
  },
];

export default function HowNetworkScales() {
  return (
    <section className="border-b border-divider bg-bg py-28">
      <Container>
        <Reveal>
          <SectionLabel index="SCALE">How The Network Scales</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-5 max-w-2xl font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
            Three reinforcing loops, one compounding advantage.
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden border border-glass bg-divider md:grid-cols-3">
          {columns.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.08}>
              <div className="h-full bg-bg p-8">
                <span className="font-mono text-xs text-accent">[ {c.n} ]</span>
                <c.icon size={22} strokeWidth={1.5} className="mt-4 text-accent" />
                <h3 className="mt-4 font-heading text-lg font-bold text-white">{c.title}</h3>
                <p className="mt-3 font-body text-sm leading-relaxed text-ink-muted">{c.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
