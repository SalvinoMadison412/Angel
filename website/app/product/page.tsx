import type { Metadata } from "next";
import { Radar, BrainCircuit, Siren, Smartphone, BatteryCharging } from "lucide-react";
import ProductHero from "@/components/product/ProductHero";
import FeatureDeepDive, { type Feature } from "@/components/product/FeatureDeepDive";
import SpecsTable from "@/components/product/SpecsTable";
import InTheBox from "@/components/product/InTheBox";
import ProductFAQ from "@/components/product/ProductFAQ";
import BuyCTA from "@/components/product/BuyCTA";

export const metadata: Metadata = {
  title: "AGL v1 — The World's Most Intelligent Crash Detector | Angel",
  description:
    "AGL v1 detects crashes in under 100ms, analyzes severity with onboard AI, and automatically alerts emergency contacts with your live GPS location. $199, ships in 3–5 days.",
};

const features: Feature[] = [
  {
    n: "01",
    icon: Radar,
    title: "Crash Detection Engine",
    body: "A fused 6-axis IMU reads acceleration and rotation hundreds of times per second. AGL v1's detection engine recognizes the signature of a real collision — not a curb, not a slammed door — in under 100ms.",
    points: ["Accelerometer + gyroscope fusion", "Sub-100ms trigger latency", "Calibrated for cars, motorcycles & fleet vehicles"],
  },
  {
    n: "02",
    icon: BrainCircuit,
    title: "AI Severity Analysis",
    body: "Not every impact needs an ambulance. AGL v1's onboard model classifies severity in real time, distinguishing a minor fender-bender from a serious collision so alerts stay meaningful.",
    points: ["Trained on real-world collision data", "Reduces false-positive dispatches", "Runs fully on-device, no cloud round-trip"],
  },
  {
    n: "03",
    icon: Siren,
    title: "Automatic SOS",
    body: "When a serious crash is confirmed, AGL v1 dials emergency services and pings your emergency contacts with a live GPS pin — automatically, with a short window to cancel if you're okay.",
    points: ["Dials local emergency services directly", "Live GPS pin shared instantly", "Cancellable countdown window"],
  },
  {
    n: "04",
    icon: Smartphone,
    title: "Companion App",
    body: "Pair AGL v1 with the Angel app on iOS and Android for real-time monitoring, trip history, guardian management, and instant push notifications the moment something happens.",
    points: ["iOS & Android support", "Guardian / emergency contact management", "Real-time device status & trip history"],
  },
  {
    n: "05",
    icon: BatteryCharging,
    title: "Long Battery Life",
    body: "A 1500mAh battery keeps AGL v1 running up to 72 hours on standby. It tops up over USB-C, so a quick charge on your commute is all it ever needs.",
    points: ["72-hour standby battery", "USB-C fast charging", "Low-power alert mode below 10%"],
  },
];

export default function ProductPage() {
  return (
    <>
      <ProductHero />
      <FeatureDeepDive features={features} />
      <SpecsTable />
      <InTheBox />
      <ProductFAQ />
      <BuyCTA />
    </>
  );
}
