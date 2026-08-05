import { Radar, Send, Network, Users, ShieldCheck } from "lucide-react";
import Container from "./Container";
import SectionLabel from "./SectionLabel";
import Reveal from "./Reveal";

const steps = [
  {
    n: "01",
    icon: Radar,
    title: "Impact Detected",
    body: "Atom's 6-axis IMU registers the crash the moment it happens. AI on-device classifies severity in real time.",
  },
  {
    n: "02",
    icon: Send,
    title: "Data Transmitted",
    body: "Crash data, GPS coordinates, speed at impact, and severity score are sent to Angel's cloud infrastructure in real time.",
  },
  {
    n: "03",
    icon: Network,
    title: "Network Activated",
    body: "Angel's matching engine identifies and notifies the nearest available partners — EMS, tow services, and hospitals — simultaneously.",
  },
  {
    n: "04",
    icon: Users,
    title: "Partners Respond",
    body: "Partners receive a verified incident card on the Angel Partners app with full incident details, GPS pin, and victim information.",
  },
  {
    n: "05",
    icon: ShieldCheck,
    title: "Help Arrives",
    body: "Responders are en route before the driver's emergency contacts even finish receiving their SOS notification.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative border-b border-divider bg-bg-elevated py-28">
      <Container>
        <Reveal>
          <SectionLabel index="05">What Happens In A Crash</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-5 max-w-2xl font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
            Five seconds that save a life.
          </h2>
        </Reveal>

        <div className="mt-20 grid grid-cols-1 gap-0 md:grid-cols-5">
          {steps.map((step, i) => (
            <Reveal key={step.n} delay={i * 0.08} className="relative">
              <div
                className={`h-full border-t border-divider p-6 pr-8 md:border-t-0 md:border-l ${
                  i === 0 ? "md:border-l-0" : ""
                }`}
              >
                <span className="font-mono text-xs text-accent">[ {step.n} ]</span>
                <div className="mt-6 flex h-11 w-11 items-center justify-center border border-glass text-accent">
                  <step.icon size={20} strokeWidth={1.6} />
                </div>
                <h3 className="mt-6 font-heading text-lg font-bold text-white">{step.title.toUpperCase()}</h3>
                <p className="mt-3 font-body text-sm leading-relaxed text-ink-muted">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
