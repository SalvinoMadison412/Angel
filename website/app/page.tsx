import Hero from "@/components/home/Hero";
import HowItWorks from "@/components/home/HowItWorks";
import WhyAngel from "@/components/home/WhyAngel";
import StatsBar from "@/components/home/StatsBar";
import Testimonials from "@/components/home/Testimonials";
import InvestorTrust from "@/components/home/InvestorTrust";
import CTABanner from "@/components/home/CTABanner";

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <WhyAngel />
      <StatsBar />
      <Testimonials />
      <InvestorTrust />
      <CTABanner />
    </>
  );
}
