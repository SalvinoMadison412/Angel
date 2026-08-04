import type { Metadata } from "next";
import Container from "@/components/Container";
import SectionLabel from "@/components/SectionLabel";

export const metadata: Metadata = {
  title: "Privacy Policy | Angel",
};

export default function PrivacyPage() {
  return (
    <section className="border-b border-divider pt-[72px]">
      <Container className="max-w-3xl py-24">
        <SectionLabel index="LEGAL">Privacy Policy</SectionLabel>
        <h1 className="mt-5 font-heading text-4xl font-bold text-white">Privacy Policy</h1>
        <p className="mt-4 font-mono text-[11px] uppercase tracking-widest2 text-ink-dim">Last updated: January 2026</p>

        <div className="mt-12 space-y-8 font-body text-sm leading-relaxed text-ink-muted sm:text-base">
          <p>
            Angel Technologies ("Angel", "we", "us") collects the minimum data necessary to operate AGL v1's crash
            detection and emergency alerting functions: device telemetry (accelerometer, gyroscope, GPS), account
            information you provide (name, email, emergency contacts), and diagnostic data used to improve
            detection accuracy.
          </p>
          <p>
            Location and impact data collected by AGL v1 is used exclusively to detect crashes, dispatch alerts to
            your designated emergency contacts and services, and improve our severity-classification models. We do
            not sell location or telemetry data to third parties.
          </p>
          <p>
            You may request a copy of your data or its deletion at any time by contacting hello@angel.tech.
            Emergency contact information is stored only for as long as your account remains active, and is
            encrypted in transit and at rest.
          </p>
          <p>
            This policy may be updated as Angel's products evolve. Material changes will be communicated via the
            email associated with your account.
          </p>
        </div>
      </Container>
    </section>
  );
}
