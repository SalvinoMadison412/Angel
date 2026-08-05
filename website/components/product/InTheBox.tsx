import { Cpu, Cable, Compass, BookOpen } from "lucide-react";
import Container from "../Container";
import SectionLabel from "../SectionLabel";
import Reveal from "../Reveal";

const items = [
  { icon: Cpu, label: "Atom Device" },
  { icon: Cable, label: "USB-C Charging Cable" },
  { icon: Compass, label: "Windshield Mount" },
  { icon: BookOpen, label: "Quick Start Guide" },
];

export default function InTheBox() {
  return (
    <section className="border-b border-divider bg-bg py-28">
      <Container>
        <Reveal>
          <SectionLabel index="06">In The Box</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-5 max-w-2xl font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
            Everything you need. Nothing you don't.
          </h2>
        </Reveal>

        <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden border border-glass bg-divider md:grid-cols-4">
          {items.map((item, i) => (
            <Reveal key={item.label} delay={i * 0.06}>
              <div className="flex h-full flex-col items-center gap-5 bg-bg p-10 text-center">
                <item.icon size={28} strokeWidth={1.4} className="text-accent" />
                <span className="font-mono text-[11px] uppercase tracking-widest2 text-ink-muted">{item.label}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
