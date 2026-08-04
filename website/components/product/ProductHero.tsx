"use client";

import { motion } from "framer-motion";
import { Truck, RotateCcw, ShieldCheck } from "lucide-react";
import Container from "../Container";
import Button from "../Button";
import DeviceRender from "../DeviceRender";

const badges = [
  { icon: Truck, label: "Free Shipping" },
  { icon: RotateCcw, label: "30-Day Returns" },
  { icon: ShieldCheck, label: "2-Year Warranty" },
];

export default function ProductHero() {
  return (
    <section className="relative overflow-hidden border-b border-divider pt-[72px]">
      <div className="dot-grid-faint fade-mask-b pointer-events-none absolute inset-0" />
      <Container className="relative grid grid-cols-1 items-center gap-16 py-20 lg:grid-cols-[0.95fr_1.05fr] lg:py-28">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="relative order-2 mx-auto w-full max-w-md lg:order-1"
        >
          <div className="bracket-corner border border-glass bg-glass-fill p-10">
            <DeviceRender className="w-full drop-shadow-2xl" />
          </div>
          <div className="mt-6 flex justify-between font-mono text-[10px] uppercase tracking-widest2 text-ink-dim">
            <span>[ 65 × 35 × 12 mm ]</span>
            <span>[ 48g ]</span>
          </div>
        </motion.div>

        <div className="order-1 lg:order-2">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-widest2 text-accent"
          >
            <span className="h-px w-6 bg-accent" />[ PRODUCT — 01 ]
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08 }}
            className="mt-6 font-heading text-5xl font-bold text-white sm:text-6xl"
          >
            AGL v1
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.14 }}
            className="mt-3 font-heading text-lg text-ink-muted sm:text-xl"
          >
            The World's Most Intelligent Crash Detector
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-8 flex items-end gap-3"
          >
            <span className="font-heading text-4xl font-bold text-white">$199</span>
            <span className="mb-1 font-mono text-xs uppercase tracking-widest2 text-ink-dim">
              Ships in 3–5 business days
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.26 }}
            className="mt-8"
          >
            <Button href="#buy" size="lg" icon className="w-full sm:w-auto">
              Add to Cart
            </Button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.32 }}
            className="mt-10 flex flex-wrap gap-6 border-t border-divider pt-6"
          >
            {badges.map((b) => (
              <div key={b.label} className="flex items-center gap-2 text-ink-muted">
                <b.icon size={16} className="text-accent" strokeWidth={1.6} />
                <span className="font-mono text-[11px] uppercase tracking-widest2">{b.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
