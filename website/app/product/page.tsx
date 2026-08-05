import type { Metadata } from "next";
import ProductHero from "@/components/product/ProductHero";
import NetworkConnection from "@/components/product/NetworkConnection";
import SpecsTable from "@/components/product/SpecsTable";
import DevelopmentNote from "@/components/product/DevelopmentNote";
import InTheBox from "@/components/product/InTheBox";
import ProductFAQ from "@/components/product/ProductFAQ";
import BuyCTA from "@/components/product/BuyCTA";

export const metadata: Metadata = {
  title: "Atom — The Hardware That Joins You to the Network | Angel",
  description:
    "Atom is your entry point into the Angel safety network. Detects crashes in real time and connects you to every responder, tow fleet, and hospital on the platform. $199, ships in 3–5 days.",
};

export default function ProductPage() {
  return (
    <>
      <ProductHero />
      <NetworkConnection />
      <SpecsTable />
      <DevelopmentNote />
      <InTheBox />
      <ProductFAQ />
      <BuyCTA />
    </>
  );
}
