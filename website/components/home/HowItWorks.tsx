import { Radar, BrainCircuit, Siren, MapPinned, ShieldCheck } from "lucide-react";
import Container from "../Container";
import SectionLabel from "../SectionLabel";
import Reveal from "../Reveal";

const steps = [
  {
    n: "01",
    icon: Radar,
    title: "Detect",
    body: "Onboard accelerometers and gyroscopes continuously monitor motion. The moment an impact pattern is recognized, AGL v1 flags it in milliseconds — no phone unlock, no app to open.",
  },
  {
    n: "02",
    icon: BrainCircuit,
    title: "Analyze",
    body: "An onboard AI model instantly cross-references impact force, deceleration curve, and orientation change to classify severity — separating a pothole from a real collision.",
  },
  {
    n: "03",
    icon: Siren,
    title: "Alert",
    body: "If a serious crash is confirmed, an automatic SOS fires to emergency contacts and services, carrying your live GPS location and a countdown window to cancel a false alarm.",
  },
  {
    n: "04",
    icon: MapPinned,
    title: "Respond",
    body: "Emergency responders are dispatched to your exact coordinates. No guessing, no delay describing where you are — Angel already told them.",
  },
  {
    n: "05",
    icon: ShieldCheck,
    title: "Protect",
    body: "Angel keeps monitoring post-crash — tracking vitals of the situation and staying connected to responders until help physically arrives on scene.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative border-b border-divider bg-bg py-28">
      <Container>
        <Reveal>
          <SectionLabel index="PROCESS">How It Works</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-5 max-w-2xl font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
            From impact to intervention in one continuous system.
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
