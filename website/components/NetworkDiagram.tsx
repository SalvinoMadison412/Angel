"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";

type Node = { x: number; y: number; label?: string };

const leftNodesFull: Node[] = [
  { x: 90, y: 100 },
  { x: 150, y: 60 },
  { x: 175, y: 170 },
  { x: 55, y: 200 },
  { x: 125, y: 260 },
  { x: 195, y: 240 },
  { x: 65, y: 320 },
];

const rightNodesFull: Node[] = [
  { x: 700, y: 90, label: "EMS" },
  { x: 640, y: 55, label: "FIRE / POLICE" },
  { x: 615, y: 165, label: "TOW & ROADSIDE" },
  { x: 745, y: 205, label: "INSURANCE" },
  { x: 665, y: 275, label: "HOSPITALS" },
  { x: 600, y: 245, label: "FLEETS" },
];

const leftNodesCompact: Node[] = [
  { x: 70, y: 70 },
  { x: 120, y: 30 },
  { x: 130, y: 130 },
  { x: 35, y: 150 },
  { x: 90, y: 190 },
];

const rightNodesCompact: Node[] = [
  { x: 530, y: 70 },
  { x: 480, y: 30 },
  { x: 470, y: 130 },
  { x: 565, y: 150 },
  { x: 510, y: 190 },
];

// deterministic pseudo-random generator so server and client render identically
function seededPoints(count: number, width: number, height: number, seed: number) {
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Array.from({ length: count }, () => ({
    x: rand() * width,
    y: rand() * height,
    r: 0.6 + rand() * 1.1,
    delay: rand() * 4,
    duration: 2.5 + rand() * 3,
  }));
}

export default function NetworkDiagram({
  variant = "compact",
  className = "",
}: {
  variant?: "compact" | "full";
  className?: string;
}) {
  const isFull = variant === "full";
  const width = isFull ? 800 : 600;
  const height = isFull ? 380 : 240;
  const hub = { x: width / 2, y: height / 2 };
  const leftNodes = isFull ? leftNodesFull : leftNodesCompact;
  const rightNodes = isFull ? rightNodesFull : rightNodesCompact;
  const ambient = seededPoints(isFull ? 96 : 60, width, height, 42);
  const joiners = ambient.filter((_, i) => i % 9 === 0);

  const mvX = useMotionValue(0);
  const mvY = useMotionValue(0);
  const springX = useSpring(mvX, { stiffness: 50, damping: 14 });
  const springY = useSpring(mvY, { stiffness: 50, damping: 14 });

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width - 0.5;
    const relY = (e.clientY - rect.top) / rect.height - 0.5;
    mvX.set(relX * (isFull ? 16 : 9));
    mvY.set(relY * (isFull ? 12 : 7));
  };
  const handlePointerLeave = () => {
    mvX.set(0);
    mvY.set(0);
  };

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Diagram of the Angel network connecting drivers to partner organizations through central infrastructure"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      <defs>
        <filter id="ndGlow" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ambient network — a much larger field hinted at through faint scattered nodes, drifting with the cursor */}
      <motion.g style={{ x: springX, y: springY }}>
        {ambient.map((p, i) => (
          <motion.circle
            key={`amb-${i}`}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill="#FFFFFF"
            animate={{ opacity: [0.05, 0.35, 0.05] }}
            transition={{ duration: p.duration, repeat: Infinity, ease: "easeInOut", delay: p.delay }}
          />
        ))}

        {/* occasional new nodes joining the network, marked with an expanding ripple */}
        {joiners.map((p, i) => (
          <motion.circle
            key={`join-${i}`}
            cx={p.x}
            cy={p.y}
            r={1}
            fill="none"
            stroke="#FF5722"
            strokeWidth="1"
            initial={{ r: 1, opacity: 0.8 }}
            animate={{ r: [1, isFull ? 16 : 10], opacity: [0.8, 0] }}
            transition={{
              duration: 2.8,
              repeat: Infinity,
              ease: "easeOut",
              delay: p.delay + i * 1.6,
              repeatDelay: 4 + (i % 3),
            }}
          />
        ))}
      </motion.g>

      {/* connecting lines */}
      {leftNodes.map((n, i) => (
        <line
          key={`l-${i}`}
          x1={n.x}
          y1={n.y}
          x2={hub.x}
          y2={hub.y}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
        />
      ))}
      {rightNodes.map((n, i) => (
        <line
          key={`r-${i}`}
          x1={hub.x}
          y1={hub.y}
          x2={n.x}
          y2={n.y}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
        />
      ))}

      {/* traveling packets: left -> hub */}
      {leftNodes.map((n, i) => (
        <motion.circle
          key={`lp-${i}`}
          r={2.5}
          fill="#FF5722"
          initial={{ cx: n.x, cy: n.y, opacity: 0 }}
          animate={{ cx: [n.x, hub.x], cy: [n.y, hub.y], opacity: [0, 1, 1, 0] }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.35,
          }}
        />
      ))}

      {/* traveling packets: hub -> right */}
      {rightNodes.map((n, i) => (
        <motion.circle
          key={`rp-${i}`}
          r={2.5}
          fill="#FF5722"
          initial={{ cx: hub.x, cy: hub.y, opacity: 0 }}
          animate={{ cx: [hub.x, n.x], cy: [hub.y, n.y], opacity: [0, 1, 1, 0] }}
          transition={{
            duration: 2.2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1.1 + i * 0.35,
          }}
        />
      ))}

      {/* left cluster nodes */}
      {leftNodes.map((n, i) => (
        <g key={`ln-${i}`}>
          <circle cx={n.x} cy={n.y} r={isFull ? 6 : 4.5} fill="#0A0A0A" stroke="#FFFFFF" strokeOpacity="0.4" />
          <circle cx={n.x} cy={n.y} r={isFull ? 2.5 : 2} fill="#FFFFFF" fillOpacity="0.8" />
        </g>
      ))}

      {/* right cluster nodes */}
      {rightNodes.map((n, i) => (
        <g key={`rn-${i}`}>
          <circle cx={n.x} cy={n.y} r={isFull ? 6 : 4.5} fill="#0A0A0A" stroke="#FF5722" strokeOpacity="0.6" />
          <circle cx={n.x} cy={n.y} r={isFull ? 2.5 : 2} fill="#FF5722" />
          {isFull && n.label && (
            <text
              x={n.x > hub.x ? n.x + 12 : n.x - 12}
              y={n.y + 3}
              textAnchor={n.x > hub.x ? "start" : "end"}
              fontFamily="var(--font-jetbrains-mono)"
              fontSize="9"
              letterSpacing="0.5"
              fill="rgba(255,255,255,0.55)"
            >
              {n.label}
            </text>
          )}
        </g>
      ))}

      {/* hub */}
      <motion.circle
        cx={hub.x}
        cy={hub.y}
        r={isFull ? 15 : 20}
        fill="rgba(255,87,34,0.12)"
        animate={{ r: isFull ? [15, 20, 15] : [20, 26, 20] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.circle
        cx={hub.x}
        cy={hub.y}
        r={isFull ? 22 : 28}
        fill="none"
        stroke="#FF5722"
        strokeWidth="1.5"
        filter="url(#ndGlow)"
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <circle cx={hub.x} cy={hub.y} r={isFull ? 8 : 10} fill="#0A0A0A" stroke="#FF5722" strokeWidth="1" />
      <path
        d={`M${hub.x - (isFull ? 5 : 6)} ${hub.y} H${hub.x - 1} L${hub.x + 1} ${hub.y - (isFull ? 6 : 7)} L${
          hub.x + 3
        } ${hub.y + (isFull ? 6 : 7)} L${hub.x + 5} ${hub.y} H${hub.x + (isFull ? 5 : 6)}`}
        stroke="#FF5722"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {isFull && (
        <>
          <text
            x={hub.x}
            y={hub.y + 42}
            textAnchor="middle"
            fontFamily="var(--font-jetbrains-mono)"
            fontSize="10"
            letterSpacing="1.5"
            fill="#FF5722"
          >
            ANGEL INFRASTRUCTURE
          </text>
          <text
            x={leftNodes.reduce((a, n) => a + n.x, 0) / leftNodes.length}
            y={20}
            textAnchor="middle"
            fontFamily="var(--font-jetbrains-mono)"
            fontSize="10"
            letterSpacing="1.5"
            fill="rgba(255,255,255,0.5)"
          >
            DRIVERS
          </text>
          <text
            x={rightNodes.reduce((a, n) => a + n.x, 0) / rightNodes.length}
            y={20}
            textAnchor="middle"
            fontFamily="var(--font-jetbrains-mono)"
            fontSize="10"
            letterSpacing="1.5"
            fill="rgba(255,255,255,0.5)"
          >
            PARTNERS
          </text>
        </>
      )}
    </svg>
  );
}
