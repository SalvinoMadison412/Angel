import { LucideIcon } from "lucide-react";
import Container from "../Container";
import Reveal from "../Reveal";

export type Feature = {
  n: string;
  icon: LucideIcon;
  title: string;
  body: string;
  points: string[];
};

export default function FeatureDeepDive({ features }: { features: Feature[] }) {
  return (
    <section className="border-b border-divider bg-bg py-8">
      {features.map((f, i) => (
        <Container key={f.title} className="border-t border-divider py-20 first:border-t-0">
          <div
            className={`grid grid-cols-1 items-center gap-14 lg:grid-cols-2 ${
              i % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
            }`}
          >
            <Reveal direction={i % 2 === 1 ? "right" : "left"}>
              <div className="bracket-corner flex aspect-[4/3] items-center justify-center border border-glass bg-glass-fill">
                <f.icon size={72} strokeWidth={1} className="text-accent" />
              </div>
            </Reveal>

            <Reveal direction={i % 2 === 1 ? "left" : "right"} delay={0.1}>
              <span className="font-mono text-xs text-accent">[ {f.n} ]</span>
              <h3 className="mt-4 font-heading text-2xl font-bold text-white sm:text-3xl">{f.title}</h3>
              <p className="mt-4 font-body text-base leading-relaxed text-ink-muted">{f.body}</p>
              <ul className="mt-6 space-y-3">
                {f.points.map((p) => (
                  <li key={p} className="flex items-start gap-3 font-mono text-xs uppercase tracking-widest2 text-ink-muted">
                    <span className="mt-1 h-1 w-1 shrink-0 bg-accent" />
                    {p}
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </Container>
      ))}
    </section>
  );
}
