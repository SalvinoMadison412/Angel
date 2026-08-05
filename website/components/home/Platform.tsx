import { Radar, MapPin, Bell, Clock3, BarChart3, Siren, Flame, Truck, Building2, Landmark } from "lucide-react";
import Container from "../Container";
import SectionLabel from "../SectionLabel";
import Reveal from "../Reveal";

const driverFeatures = [
  { icon: Radar, label: "Automatic crash detection via Atom" },
  { icon: MapPin, label: "Live location sharing with emergency contacts" },
  { icon: Bell, label: "One-tap SOS to all connected partner services" },
  { icon: Clock3, label: "Real-time ETA from dispatched responders" },
  { icon: BarChart3, label: "Trip history and safety analytics" },
];

const partnerTypes = [
  { icon: Siren, label: "Emergency medical services (EMS)" },
  { icon: Flame, label: "Fire and police departments" },
  { icon: Truck, label: "Tow truck and roadside fleets" },
  { icon: Landmark, label: "Insurance companies" },
  { icon: Building2, label: "Hospitals and trauma centres" },
];

export default function Platform() {
  return (
    <section id="platform" className="scroll-mt-[72px] border-b border-divider bg-bg-elevated py-28">
      <Container>
        <Reveal>
          <SectionLabel index="04">Two Apps. One Network.</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-5 max-w-2xl font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
            One side detects the emergency. The other side responds to it.
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-0 border border-glass lg:grid-cols-2">
          <Reveal direction="left" className="h-full">
            <div className="h-full border-b border-divider p-8 lg:border-b-0 lg:border-r lg:p-12">
              <span className="font-mono text-[11px] uppercase tracking-widest2 text-ink-dim">[ Consumer ]</span>
              <h3 className="mt-3 font-heading text-2xl font-bold text-white">For Drivers</h3>
              <p className="mt-4 font-body text-sm leading-relaxed text-ink-muted sm:text-base">
                The consumer app that turns any phone into a 24/7 safety companion. Detects crashes, triggers
                SOS, shares live GPS, and connects to the nearest available partner — automatically.
              </p>
              <ul className="mt-8 space-y-4">
                {driverFeatures.map((f) => (
                  <li key={f.label} className="flex items-start gap-3">
                    <f.icon size={16} strokeWidth={1.6} className="mt-0.5 shrink-0 text-accent" />
                    <span className="font-mono text-xs uppercase tracking-widest2 text-ink-muted">{f.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal direction="right" className="h-full">
            <div className="h-full p-8 lg:p-12">
              <span className="font-mono text-[11px] uppercase tracking-widest2 text-ink-dim">[ B2B ]</span>
              <h3 className="mt-3 font-heading text-2xl font-bold text-white">For Partners</h3>
              <p className="mt-4 font-body text-sm leading-relaxed text-ink-muted sm:text-base">
                The operations app that brings emergency responders, tow services, hospitals, and insurers onto
                the Angel network. Receive verified incident alerts with GPS, victim data, and severity
                classification — before a single call is made.
              </p>
              <ul className="mt-8 space-y-4">
                {partnerTypes.map((f) => (
                  <li key={f.label} className="flex items-start gap-3">
                    <f.icon size={16} strokeWidth={1.6} className="mt-0.5 shrink-0 text-accent" />
                    <span className="font-mono text-xs uppercase tracking-widest2 text-ink-muted">{f.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div className="mt-6 flex flex-col items-center gap-3 border border-glass bg-glass-fill px-8 py-6 text-center">
            <span className="font-mono text-xs uppercase tracking-widest2 text-accent">
              [ Angel Infrastructure — AI · Real-time Data · Network Matching ]
            </span>
            <p className="max-w-xl font-body text-sm text-ink-muted">
              Every driver and every partner connect through the same real-time layer — the part of Angel that
              makes the network valuable.
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
