import type { Metadata } from "next";
import { Space_Mono, JetBrains_Mono, Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const spaceMono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-space-mono",
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
  title: "Angel — Drive Safer. React Faster. Survive Anything.",
  description:
    "Angel builds AGL v1, an intelligent crash detection device that senses impact in milliseconds, alerts emergency contacts automatically, and dispatches help with your exact location.",
  keywords: ["Angel", "AGL v1", "crash detection", "car safety device", "automatic SOS", "emergency alert"],
  openGraph: {
    title: "Angel — Drive Safer. React Faster. Survive Anything.",
    description:
      "AGL v1 detects crashes in under 100ms and automatically alerts emergency contacts with your live location.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceMono.variable} ${jetbrainsMono.variable} ${inter.variable}`}>
      <body className="font-body bg-bg text-ink antialiased">
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
