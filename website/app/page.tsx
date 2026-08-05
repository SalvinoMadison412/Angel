import Hero from "@/components/home/Hero";
import Platform from "@/components/home/Platform";
import NetworkEffect from "@/components/home/NetworkEffect";
import HowItWorks from "@/components/HowItWorks";
import WhyNow from "@/components/home/WhyNow";
import PartnerEcosystem from "@/components/home/PartnerEcosystem";
import StatsBand from "@/components/StatsBand";
import WhoAngelIsFor from "@/components/home/WhoAngelIsFor";
import ForInvestors from "@/components/home/ForInvestors";
import CTABanner from "@/components/home/CTABanner";

const tractionStats = [
  {
    value: 487707,
    label: "Road accidents reported in India in 2024",
    locale: "en-IN",
    source: "MoRTH 2024",
  },
  {
    value: 177175,
    label: "Lives lost on Indian roads in 2024 — 20 every hour",
    locale: "en-IN",
    source: "MoRTH 2024",
  },
  {
    value: 46.2,
    suffix: "%",
    decimals: 1,
    label: "Of all road fatalities are two-wheeler riders",
    source: "MoRTH 2024",
  },
  {
    value: 12,
    suffix: " Million",
    label: "Gig workers on Indian roads today — growing to 23.5M by 2030",
    source: "NITI Aayog / FY 2024-25 data",
  },
];

export default function HomePage() {
  return (
    <>
      <Hero />
      <StatsBand
        stats={tractionStats}
        sectionIndex="02"
        sectionTitle="The Problem At Scale"
        footnote="// Sources: MoRTH Road Accidents in India 2024 · NITI Aayog Gig Economy Report FY2024-25"
      />
      <WhoAngelIsFor />
      <Platform />
      <NetworkEffect />
      <HowItWorks />
      <WhyNow />
      <PartnerEcosystem />
      <ForInvestors />
      <CTABanner />
    </>
  );
}
