import { FileText, Plug, FlaskConical, Rocket } from "lucide-react";
import Container from "../Container";
import SectionLabel from "../SectionLabel";
import Reveal from "../Reveal";
import Button from "../Button";

const steps = [
  { icon: FileText, n: "01", title: "Apply", body: "Tell us your organization type and coverage area." },
  { icon: Plug, n: "02", title: "Integrate", body: "Connect via our partner API or the Angel Partners app directly." },
  { icon: FlaskConical, n: "03", title: "Verify", body: "We validate coverage zones and response protocols." },
  { icon: Rocket, n: "04", title: "Go Live", body: "Start receiving verified, real-time incident alerts." },
];

export default function PartnerIntegration() {
  return (
    <section id="partners" className="scroll-mt-[72px] border-b border-divider bg-bg py-28">
      <Container>
        <Reveal>
          <SectionLabel index="ONBOARD">Partner Integration</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-5 max-w-2xl font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
            Joining the Angel network takes under 24 hours.
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-0 md:grid-cols-4">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.08}>
              <div
                className={`h-full border-t border-divider p-6 pr-8 md:border-t-0 md:border-l ${
                  i === 0 ? "md:border-l-0" : ""
                }`}
              >
                <span className="font-mono text-xs text-accent">[ {s.n} ]</span>
                <div className="mt-6 flex h-11 w-11 items-center justify-center border border-glass text-accent">
                  <s.icon size={20} strokeWidth={1.6} />
                </div>
                <h3 className="mt-6 font-heading text-lg font-bold text-white">{s.title.toUpperCase()}</h3>
                <p className="mt-3 font-body text-sm leading-relaxed text-ink-muted">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.2} className="mt-16 flex justify-center">
          <Button href="/contact" size="lg" icon>
            Become a Partner
          </Button>
        </Reveal>
      </Container>
    </section>
  );
}
