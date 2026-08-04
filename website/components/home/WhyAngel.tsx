import { Zap, BrainCircuit, Signal, CreditCard } from "lucide-react";
import Container from "../Container";
import SectionLabel from "../SectionLabel";
import Reveal from "../Reveal";

const features = [
  {
    icon: Zap,
    title: "Instant Detection",
    body: "Sub-100ms response time from impact to alert trigger — faster than any manual 911 call could ever be placed.",
  },
  {
    icon: BrainCircuit,
    title: "AI Severity Analysis",
    body: "Distinguishes a hard brake or pothole from a genuine collision, so responders are dispatched only when it matters.",
  },
  {
    icon: Signal,
    title: "Always Connected",
    body: "Built-in 4G/5G/LTE means AGL v1 works independently of your phone's signal, battery, or proximity.",
  },
  {
    icon: CreditCard,
    title: "No Subscription Required",
    body: "Core emergency detection and alerting works out of the box — no monthly fee standing between you and help.",
  },
];

export default function WhyAngel() {
  return (
    <section className="border-b border-divider bg-bg-elevated py-28">
      <Container>
        <Reveal>
          <SectionLabel index="02">Why Angel</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-5 max-w-2xl font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
            Built to be faster than the moment that needs it.
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden border border-glass bg-divider sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.06}>
              <div className="group h-full bg-bg-elevated p-8 transition-colors duration-150 hover:bg-bg-raised">
                <div className="flex h-11 w-11 items-center justify-center border border-glass text-accent transition-colors duration-150 group-hover:border-accent">
                  <f.icon size={20} strokeWidth={1.6} />
                </div>
                <h3 className="mt-6 font-heading text-base font-bold text-white">{f.title}</h3>
                <p className="mt-3 font-body text-sm leading-relaxed text-ink-muted">{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
