import type { Metadata } from "next";
import MissionHero from "@/components/about/MissionHero";
import TwoAppStrategy from "@/components/about/TwoAppStrategy";
import Team from "@/components/about/Team";
import Timeline from "@/components/about/Timeline";
import InvestorSection from "@/components/about/InvestorSection";

export const metadata: Metadata = {
  title: "About Angel — Building the Infrastructure Layer for Road Safety",
  description:
    "Angel is building the two-sided network layer for road safety — connecting drivers with emergency responders, tow fleets, hospitals, and insurers. Meet the team and our roadmap.",
};

export default function AboutPage() {
  return (
    <>
      <MissionHero />
      <TwoAppStrategy />
      <Team />
      <Timeline />
      <InvestorSection />
    </>
  );
}
