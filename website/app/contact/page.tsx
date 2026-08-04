import type { Metadata } from "next";
import { Mail, MapPin, Clock } from "lucide-react";
import Container from "@/components/Container";
import SectionLabel from "@/components/SectionLabel";
import Reveal from "@/components/Reveal";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact Angel — Get In Touch",
  description: "Reach the Angel team for support, sales, or investor inquiries.",
};

export default function ContactPage() {
  return (
    <section className="dot-grid-faint fade-mask-b border-b border-divider pt-[72px]">
      <Container className="py-24 lg:py-32">
        <Reveal>
          <SectionLabel index="CONTACT">Get In Touch</SectionLabel>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="mt-5 max-w-2xl font-heading text-4xl font-bold leading-tight text-white sm:text-5xl">
            Questions, support, or an investment thesis to share — we're listening.
          </h1>
        </Reveal>

        <div className="mt-16 grid grid-cols-1 gap-16 lg:grid-cols-[1fr_0.85fr]">
          <Reveal delay={0.1}>
            <ContactForm />
          </Reveal>

          <Reveal delay={0.15} className="space-y-10">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <Mail size={18} className="mt-1 shrink-0 text-accent" strokeWidth={1.6} />
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-widest2 text-ink-dim">Email</div>
                  <div className="mt-1 font-heading text-base text-white">hello@angel.tech</div>
                  <div className="mt-1 font-heading text-base text-white">investors@angel.tech</div>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <MapPin size={18} className="mt-1 shrink-0 text-accent" strokeWidth={1.6} />
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-widest2 text-ink-dim">Headquarters</div>
                  <div className="mt-1 font-heading text-base text-white">
                    412 Harbor Way, Suite 300
                    <br />
                    San Francisco, CA 94111
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <Clock size={18} className="mt-1 shrink-0 text-accent" strokeWidth={1.6} />
                <div>
                  <div className="font-mono text-[11px] uppercase tracking-widest2 text-ink-dim">
                    Support Hours
                  </div>
                  <div className="mt-1 font-heading text-base text-white">Mon–Fri, 8am–6pm PT</div>
                </div>
              </div>
            </div>

            <div className="bracket-corner dot-grid relative flex aspect-[4/3] items-center justify-center border border-glass bg-glass-fill">
              <div className="text-center">
                <MapPin size={28} className="mx-auto text-accent" strokeWidth={1.4} />
                <span className="mt-3 block font-mono text-[11px] uppercase tracking-widest2 text-ink-dim">
                  [ Map — San Francisco, CA ]
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
