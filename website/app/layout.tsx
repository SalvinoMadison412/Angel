import type { Metadata } from "next";
import { Space_Mono, JetBrains_Mono, Inter, DM_Serif_Display } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import PitchDeckModal from "@/components/PitchDeckModal";
import { PitchDeckModalProvider } from "@/lib/PitchDeckModalContext";

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
  display: "swap",
});

const dmSerifDisplay = DM_Serif_Display({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-dm-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Angel — The Network That Responds Before Help Knows It's Needed",
  description:
    "Angel is the infrastructure layer for road safety — a two-sided network connecting drivers in distress with emergency responders, repair fleets, hospitals, and insurers in real time.",
  keywords: [
    "Angel",
    "Atom",
    "road safety network",
    "crash detection",
    "emergency response infrastructure",
    "two-sided marketplace",
  ],
  openGraph: {
    title: "Angel — The Network That Responds Before Help Knows It's Needed",
    description:
      "A real-time network connecting drivers, emergency responders, repair fleets, hospitals, and insurers — automatically.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${spaceMono.variable} ${jetbrainsMono.variable} ${inter.variable} ${dmSerifDisplay.variable}`}
    >
      <body className="font-body bg-bg text-ink antialiased">
        <PitchDeckModalProvider>
          <Navbar />
          <main>{children}</main>
          <Footer />
          <PitchDeckModal />
        </PitchDeckModalProvider>
      </body>
    </html>
  );
}
