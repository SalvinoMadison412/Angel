import { Bike, Car, User } from "lucide-react";
import Container from "../Container";
import SectionLabel from "../SectionLabel";
import Reveal from "../Reveal";

const columns = [
  {
    icon: Bike,
    n: "01",
    title: "Delivery Riders",
    stat: "8M+",
    statLabel: "Delivery partners on Swiggy, Zomato, Blinkit, Zepto",
    body: "They ride millions of kilometres daily with no crash detection, no automatic SOS, and no guaranteed help if something goes wrong.",
  },
  {
    icon: Car,
    n: "02",
    title: "Cab Drivers",
    stat: "4M+",
    statLabel: "Drivers on Ola, Uber, and Rapido",
    body: "Long hours, unknown routes, and zero structured emergency response when an incident happens on the road.",
  },
  {
    icon: User,
    n: "03",
    title: "Everyday Commuters",
    stat: "260M+",
    statLabel: "Registered two-wheelers in India",
    body: "India has 260 million two-wheelers on the road. Most riders have no way to automatically alert anyone if they're in a crash and unable to call for help.",
  },
];

export default function WhoAngelIsFor() {
  return (
    <section className="border-b border-divider bg-bg py-28">
      <Container>
        <Reveal>
          <SectionLabel index="03">Who Angel Is For</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-5 max-w-2xl font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
            Built for the people most exposed.
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden border border-glass bg-divider md:grid-cols-3">
          {columns.map((c, i) => (
            <Reveal key={c.title} delay={i * 0.08}>
              <div className="h-full bg-bg p-8">
                <span className="font-mono text-xs text-accent">[ {c.n} ]</span>
                <c.icon size={24} strokeWidth={1.5} className="mt-4 text-accent" />
                <h3 className="mt-5 font-heading text-lg font-bold text-white">{c.title}</h3>
                <div className="mt-3 font-mono text-2xl font-bold text-white">{c.stat}</div>
                <div className="mt-1 font-mono text-[11px] uppercase leading-relaxed tracking-widest2 text-ink-dim">
                  {c.statLabel}
                </div>
                <p className="mt-4 font-body text-sm leading-relaxed text-ink-muted">{c.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.3} className="mt-6 font-mono text-[11px] leading-relaxed text-ink-dim/60">
          {"// Sources: NITI Aayog Gig Economy Report FY2024-25 · MoRTH Road Accidents in India 2024"}
        </Reveal>
      </Container>
    </section>
  );
}
