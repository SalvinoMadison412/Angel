import Container from "../Container";
import SectionLabel from "../SectionLabel";
import Reveal from "../Reveal";

const team = [
  {
    name: "Elena Vasquez",
    role: "Chief Executive Officer",
    bio: "Former product lead at a Tier-1 automotive safety supplier. Spent a decade shipping airbag control systems before deciding the next leap in crash safety would live outside the vehicle, not inside it.",
  },
  {
    name: "Marcus Webb",
    role: "Chief Technology Officer",
    bio: "Embedded systems engineer with a background in aerospace telemetry. Built the sensor-fusion architecture that lets AGL v1 tell a pothole from a collision in under 100ms.",
  },
  {
    name: "Dr. Amara Osei",
    role: "Head of Safety",
    bio: "Trauma physician turned safety researcher. Leads Angel's clinical partnerships and makes sure every severity model is validated against real collision outcomes, not assumptions.",
  },
];

export default function Team() {
  return (
    <section className="border-b border-divider bg-bg-elevated py-28">
      <Container>
        <Reveal>
          <SectionLabel index="TEAM">Who's Building This</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-5 max-w-2xl font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
            Engineers, clinicians, and operators who've seen the gap firsthand.
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden border border-glass bg-divider md:grid-cols-3">
          {team.map((member, i) => (
            <Reveal key={member.name} delay={i * 0.08}>
              <div className="h-full bg-bg-elevated p-8">
                <div className="bracket-corner flex aspect-square items-center justify-center border border-glass bg-glass-fill">
                  <span className="font-heading text-3xl font-bold text-ink-dim">
                    {member.name
                      .split(" ")
                      .map((w) => w[0])
                      .join("")}
                  </span>
                </div>
                <h3 className="mt-6 font-heading text-lg font-bold text-white">{member.name}</h3>
                <div className="mt-1 font-mono text-[11px] uppercase tracking-widest2 text-accent">
                  {member.role}
                </div>
                <p className="mt-4 font-body text-sm leading-relaxed text-ink-muted">{member.bio}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
