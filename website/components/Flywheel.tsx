"use client";

import { motion } from "framer-motion";
import Reveal from "./Reveal";

const stages = [
  {
    n: "01",
    title: "More Drivers Join",
    body: "Every Atom sold and every app install brings a new driver onto the Angel network.",
  },
  {
    n: "02",
    title: "More Verified Incidents",
    body: "Real crashes generate real, GPS-verified, severity-scored incident data in real time.",
  },
  {
    n: "03",
    title: "More Partners Connect",
    body: "EMS, tow fleets, hospitals, and insurers join to access verified demand and faster dispatch.",
  },
  {
    n: "04",
    title: "Faster Response Wins",
    body: "Denser partner coverage cuts response time further, attracting the next wave of drivers.",
  },
];

const nodePositions = [
  { x: 150, y: 26 }, // top - 01
  { x: 274, y: 150 }, // right - 02
  { x: 150, y: 274 }, // bottom - 03
  { x: 26, y: 150 }, // left - 04
];

const arcs = [
  "M150,26 A124,124 0 0 1 274,150",
  "M274,150 A124,124 0 0 1 150,274",
  "M150,274 A124,124 0 0 1 26,150",
  "M26,150 A124,124 0 0 1 150,26",
];

export default function Flywheel() {
  return (
    <div className="flex flex-col items-center gap-16 lg:flex-row lg:items-center lg:gap-20">
      <div className="relative mx-auto aspect-square w-full max-w-[320px] shrink-0">
        <svg viewBox="0 0 300 300" className="h-full w-full" fill="none">
          {arcs.map((d, i) => (
            <g key={i}>
              <path d={d} stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" />
              <motion.path
                d={d}
                stroke="#FF5722"
                strokeWidth="1.5"
                strokeDasharray="6 10"
                animate={{ strokeDashoffset: [0, -32] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "linear", delay: i * 0.15 }}
              />
            </g>
          ))}

          <circle cx="150" cy="150" r="46" fill="rgba(255,87,34,0.08)" />
          <circle cx="150" cy="150" r="46" stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none" />
          <text
            x="150"
            y="146"
            textAnchor="middle"
            fontFamily="var(--font-jetbrains-mono)"
            fontSize="9"
            letterSpacing="1"
            fill="#FF5722"
          >
            NETWORK
          </text>
          <text
            x="150"
            y="160"
            textAnchor="middle"
            fontFamily="var(--font-jetbrains-mono)"
            fontSize="9"
            letterSpacing="1"
            fill="#FF5722"
          >
            EFFECT
          </text>

          {nodePositions.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="20" fill="#0A0A0A" stroke="#FF5722" strokeWidth="1.5" />
              <text
                x={p.x}
                y={p.y + 4}
                textAnchor="middle"
                fontFamily="var(--font-jetbrains-mono)"
                fontSize="11"
                fontWeight="700"
                fill="#FFFFFF"
              >
                {stages[i].n}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-px overflow-hidden border border-glass bg-divider sm:grid-cols-2">
        {stages.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.08}>
            <div className="h-full bg-bg p-6">
              <span className="font-mono text-xs text-accent">[ {s.n} ]</span>
              <h3 className="mt-3 font-heading text-base font-bold text-white">{s.title}</h3>
              <p className="mt-2 font-body text-sm leading-relaxed text-ink-muted">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
