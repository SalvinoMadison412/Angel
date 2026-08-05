import { Package, Smartphone, Network } from "lucide-react";
import { ArrowRight } from "lucide-react";
import Container from "../Container";
import SectionLabel from "../SectionLabel";
import Reveal from "../Reveal";

const steps = [
  { icon: Package, n: "01", title: "Buy Device", body: "Order Atom and mount it in your vehicle in minutes." },
  { icon: Smartphone, n: "02", title: "Install Angel App", body: "Pair your device and add emergency contacts." },
  { icon: Network, n: "03", title: "Joined to Network", body: "You're now a live node — visible to every partner on the platform the moment it matters." },
];

export default function NetworkConnection() {
  return (
    <section className="border-b border-divider bg-bg-elevated py-24">
      <Container>
        <Reveal>
          <SectionLabel index="ENTRY POINT">Product → Network</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-5 max-w-2xl font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
            When you buy Atom, you're not just buying a device.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-6 max-w-2xl font-body text-base leading-relaxed text-ink-muted">
            You're joining the Angel network — connected, from the first mile, to every responder, tow fleet, and
            hospital already on the platform.
          </p>
        </Reveal>

        <div className="mt-16 flex flex-col items-stretch gap-4 md:flex-row md:items-center">
          {steps.map((s, i) => (
            <div key={s.n} className="flex flex-1 items-center gap-4">
              <Reveal delay={i * 0.1} className="flex-1">
                <div className="h-full border border-glass bg-bg p-7">
                  <span className="font-mono text-xs text-accent">[ {s.n} ]</span>
                  <div className="mt-5 flex h-11 w-11 items-center justify-center border border-glass text-accent">
                    <s.icon size={20} strokeWidth={1.6} />
                  </div>
                  <h3 className="mt-5 font-heading text-base font-bold text-white">{s.title}</h3>
                  <p className="mt-2 font-body text-sm leading-relaxed text-ink-muted">{s.body}</p>
                </div>
              </Reveal>
              {i < steps.length - 1 && (
                <ArrowRight size={20} className="hidden shrink-0 text-accent md:block" strokeWidth={1.5} />
              )}
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
