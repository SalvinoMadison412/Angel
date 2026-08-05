import { Siren, Wrench, Landmark, Building2, Truck, Radio } from "lucide-react";
import Container from "../Container";
import SectionLabel from "../SectionLabel";
import Reveal from "../Reveal";

const categories = [
  { icon: Siren, label: "Emergency Services" },
  { icon: Wrench, label: "Tow & Repair" },
  { icon: Landmark, label: "Insurance" },
  { icon: Building2, label: "Hospitals" },
  { icon: Truck, label: "Fleet Managers" },
  { icon: Radio, label: "Smart City Infrastructure" },
];

export default function PartnerEcosystem() {
  return (
    <section id="partners" className="scroll-mt-[72px] border-b border-divider bg-bg-elevated py-28">
      <Container>
        <Reveal>
          <SectionLabel index="PARTNERS">Partner Ecosystem</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-5 max-w-2xl font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
            Built for every stakeholder on the road.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-6 max-w-2xl font-body text-base leading-relaxed text-ink-muted">
            Angel doesn't replace emergency services — it makes them faster. Partners on the Angel network
            receive real-time, AI-verified incident data that eliminates the most expensive bottleneck in
            emergency response: the delay between crash and first notification.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden border border-glass bg-divider sm:grid-cols-3">
          {categories.map((c, i) => (
            <Reveal key={c.label} delay={i * 0.05}>
              <div className="group flex h-full flex-col items-center justify-center gap-4 bg-bg-elevated p-8 text-center transition-colors duration-150 hover:bg-bg-raised">
                <c.icon
                  size={26}
                  strokeWidth={1.4}
                  className="text-ink-muted transition-colors duration-150 group-hover:text-accent"
                />
                <span className="font-mono text-[11px] uppercase tracking-widest2 text-ink-muted">{c.label}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
