import { Users, Building2, Lock } from "lucide-react";
import Container from "../Container";
import SectionLabel from "../SectionLabel";
import Reveal from "../Reveal";

const points = [
  {
    icon: Users,
    title: "Consumer Demand",
    body: "The Angel app and Atom hardware drive a large, growing base of drivers generating real, verified incident data.",
  },
  {
    icon: Building2,
    title: "Institutional Supply",
    body: "The Angel Partners app turns that demand into revenue — EMS, tow fleets, hospitals, and insurers pay to access it.",
  },
  {
    icon: Lock,
    title: "A Moat Neither Side Can Build Alone",
    body: "A partner-only platform has no incident data. A consumer-only app has no one to dispatch. Angel owns both sides.",
  },
];

export default function TwoAppStrategy() {
  return (
    <section className="border-b border-divider bg-bg py-28">
      <Container>
        <Reveal>
          <SectionLabel index="STRATEGY">The Two-App Strategy</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-5 max-w-2xl font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
            Why one company runs both sides of the network.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-6 max-w-2xl font-body text-base leading-relaxed text-ink-muted">
            Most safety startups build one side of this equation — a consumer app, or a dispatch tool for
            responders — and hope a network forms around it. Angel builds both deliberately, because the value of
            each side depends entirely on the other.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden border border-glass bg-divider md:grid-cols-3">
          {points.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.08}>
              <div className="h-full bg-bg p-8">
                <p.icon size={22} strokeWidth={1.5} className="text-accent" />
                <h3 className="mt-5 font-heading text-base font-bold text-white">{p.title}</h3>
                <p className="mt-3 font-body text-sm leading-relaxed text-ink-muted">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
