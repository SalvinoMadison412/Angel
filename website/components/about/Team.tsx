import Container from "../Container";
import SectionLabel from "../SectionLabel";
import Reveal from "../Reveal";
import FounderAvatar from "./FounderAvatar";

// TODO: add Sherwin's bio
const team = [
  {
    name: "Salvino Kevin Madison",
    role: "Co-Founder",
    initials: "SKM",
    photoSrc: "/assets/salvino.jpg",
    bio: "Salvino founded Angel after watching how little safety infrastructure exists for the millions of people who ride for a living. He spent two years as a Data Analyst at SNP Global, building the habit of making decisions from data, not instinct, while simultaneously running The Library Company's full marketing operation — proving he could turn strategy into execution. At Angel, he brings both disciplines together: the rigor to understand markets and the creativity to move them, driving the partnerships that turn the network's vision into a working system.",
  },
  {
    name: "Sherwin Judas Madison",
    role: "Co-Founder & CFO",
    initials: "SJM",
    bio: null,
  },
];

export default function Team() {
  return (
    <section className="border-b border-divider bg-bg-elevated py-28">
      <Container>
        <Reveal>
          <SectionLabel index="TEAM">Founders</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-5 max-w-2xl font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
            Built by operators who refused to look away from the gap.
          </h2>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-2">
          {team.map((member, i) => (
            <Reveal key={member.name} delay={i * 0.08}>
              <div className="group relative h-full overflow-hidden rounded-sm border border-glass bg-gradient-to-b from-glass-fill-raised to-transparent p-9 shadow-[0_8px_30px_rgba(0,0,0,0.3)] transition-all duration-300 hover:-translate-y-1 hover:border-accent-border hover:shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
                <div
                  className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent/10 blur-[80px] transition-opacity duration-300 group-hover:opacity-100"
                  aria-hidden
                />
                <FounderAvatar name={member.name} initials={member.initials} photoSrc={member.photoSrc} />
                <h3 className="relative mt-7 font-heading text-2xl text-white">{member.name}</h3>
                <div className="relative mt-1.5 font-mono text-[11px] uppercase tracking-widest2 text-accent">
                  {member.role}
                </div>
                {member.bio ? (
                  <p className="relative mt-4 font-body text-[15px] leading-[1.7] text-ink-muted">{member.bio}</p>
                ) : (
                  <p className="relative mt-4 font-body text-[15px] italic leading-[1.7] text-ink-dim">
                    Bio coming soon.
                  </p>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
