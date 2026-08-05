"use client";

import { motion } from "framer-motion";
import Container from "../Container";
import SectionLabel from "../SectionLabel";

export default function NetworkHero() {
  return (
    <section className="dot-grid-faint fade-mask-b relative border-b border-divider pt-[72px]">
      <Container className="py-24 lg:py-32">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <SectionLabel index="NETWORK">Platform Architecture</SectionLabel>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="mt-6 max-w-3xl font-heading text-4xl font-bold leading-[1.1] text-white sm:text-5xl lg:text-6xl"
        >
          Infrastructure, not just an app.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.14 }}
          className="mt-8 max-w-2xl font-body text-base leading-relaxed text-ink-muted sm:text-lg"
        >
          Angel operates a real-time matching network connecting millions of potential crash events to hundreds
          of partner organisations — built on a cloud-native, AI-first stack.
        </motion.p>
      </Container>
    </section>
  );
}
