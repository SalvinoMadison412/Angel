import { ShieldCheck, FlaskConical, Award, Building2 } from "lucide-react";
import Container from "../Container";
import SectionLabel from "../SectionLabel";
import Reveal from "../Reveal";

const badges = [
  { icon: FlaskConical, label: "Safety Research Partner" },
  { icon: ShieldCheck, label: "CE / FCC Certified" },
  { icon: Award, label: "RoHS Compliant" },
  { icon: Building2, label: "ISO 9001 Manufacturing" },
];

export default function InvestorTrust() {
  return (
    <section className="border-b border-divider bg-bg-elevated py-28">
      <Container>
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-center">
          <div>
            <Reveal>
              <SectionLabel index="04">Backed By Rigor</SectionLabel>
            </Reveal>
            <Reveal delay={0.05}>
              <h2 className="mt-5 font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
                Backed by cutting-edge safety research.
              </h2>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-6 max-w-lg font-body text-base leading-relaxed text-ink-muted">
                Angel was founded on a simple premise: the seconds after a crash decide outcomes, and most of them
                are wasted. Our crash-detection algorithms are developed in collaboration with automotive safety
                researchers and validated against real-world collision datasets — not simulated ones. Every AGL v1
                unit ships through independently audited manufacturing, so what we promise investors and what
                reaches the road are the same device.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.15}>
            <div className="grid grid-cols-2 gap-px overflow-hidden border border-glass bg-divider">
              {badges.map((b) => (
                <div
                  key={b.label}
                  className="flex flex-col items-start gap-4 bg-bg-elevated p-8 transition-colors hover:bg-bg-raised"
                >
                  <b.icon size={24} className="text-accent" strokeWidth={1.5} />
                  <span className="font-mono text-[11px] uppercase leading-relaxed tracking-widest2 text-ink-muted">
                    {b.label}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
