import { Quote } from "lucide-react";
import Container from "../Container";
import SectionLabel from "../SectionLabel";
import Reveal from "../Reveal";

const testimonials = [
  {
    name: "Maria Chen",
    role: "AGL v1 Owner, Austin TX",
    quote:
      "I hydroplaned on the highway and don't remember much after the spin. Angel had already alerted my husband and dispatched help before I found my phone under the seat.",
  },
  {
    name: "David Okafor",
    role: "Fleet Manager, Lagos",
    quote:
      "We equipped our entire delivery fleet with AGL v1. The severity filtering means we're not getting false alarms every time someone hits a curb — only when it actually matters.",
  },
  {
    name: "Priya Ramesh",
    role: "AGL v1 Owner, Bangalore",
    quote:
      "My daughter drives alone at night for her job. Knowing Angel is watching and would notify us instantly if something happened has genuinely changed how I sleep.",
  },
];

export default function Testimonials() {
  return (
    <section className="border-b border-divider bg-bg py-28">
      <Container>
        <Reveal>
          <SectionLabel index="03">Trusted On The Road</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-5 max-w-2xl font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
            Real drivers. Real moments Angel was there for.
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.08}>
              <div className="flex h-full flex-col border border-glass bg-glass-fill p-8">
                <Quote size={22} className="text-accent" strokeWidth={1.5} />
                <p className="mt-6 flex-1 font-body text-sm leading-relaxed text-white/90">"{t.quote}"</p>
                <div className="mt-8 border-t border-divider pt-5">
                  <div className="font-heading text-sm font-bold text-white">{t.name}</div>
                  <div className="mt-1 font-mono text-[11px] uppercase tracking-widest2 text-ink-dim">{t.role}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
