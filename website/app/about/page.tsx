import type { Metadata } from "next";
import MissionHero from "@/components/about/MissionHero";
import Team from "@/components/about/Team";
import Timeline from "@/components/about/Timeline";
import InvestorSection from "@/components/about/InvestorSection";

export const metadata: Metadata = {
  title: "About Angel — Building the Standard for Crash Response",
  description:
    "Angel is building AGL v1, an intelligent crash detection device, to close the gap between a collision and the help that follows. Meet the team and our roadmap.",
};

export default function AboutPage() {
  return (
    <>
      <MissionHero />
      <Team />
      <Timeline />
      <InvestorSection />
    </>
  );
}
