export default function DeviceRender({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#232323" />
          <stop offset="55%" stopColor="#151515" />
          <stop offset="100%" stopColor="#0a0a0a" />
        </linearGradient>
        <linearGradient id="faceGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1c1c1c" />
          <stop offset="100%" stopColor="#0d0d0d" />
        </linearGradient>
        <radialGradient id="ledGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FF5722" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#FF5722" stopOpacity="0" />
        </radialGradient>
        <filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="18" stdDeviation="24" floodColor="#000000" floodOpacity="0.55" />
        </filter>
      </defs>

      <ellipse cx="200" cy="330" rx="120" ry="16" fill="#000000" opacity="0.4" />

      <g filter="url(#softShadow)">
        <rect x="70" y="90" width="260" height="180" rx="28" fill="url(#bodyGrad)" stroke="#2a2a2a" strokeWidth="1.5" />
        <rect x="86" y="106" width="228" height="148" rx="18" fill="url(#faceGrad)" stroke="#232323" />

        {/* screw motifs */}
        {[
          [98, 118],
          [302, 118],
          [98, 242],
          [302, 242],
        ].map(([cx, cy], i) => (
          <g key={i}>
            <circle cx={cx} cy={cy} r="5" fill="#050505" stroke="#333333" strokeWidth="1" />
            <line x1={cx - 2.6} y1={cy} x2={cx + 2.6} y2={cy} stroke="#4a4a4a" strokeWidth="1" />
          </g>
        ))}

        {/* speaker / mic grille */}
        {Array.from({ length: 5 }).map((_, i) => (
          <circle key={i} cx={122 + i * 10} cy={126} r="1.4" fill="#3a3a3a" />
        ))}

        {/* LED status ring */}
        <circle cx="200" cy="180" r="34" fill="url(#ledGlow)" />
        <circle cx="200" cy="180" r="22" fill="#0a0a0a" stroke="#FF5722" strokeWidth="1.5" />
        <circle cx="200" cy="180" r="14" fill="#FF5722" opacity="0.9" />
        <path
          d="M188 180H196L199 172L203 188L206 180H212"
          stroke="#0a0a0a"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* measurement tick marks */}
        <g stroke="#3a3a3a" strokeWidth="1">
          {Array.from({ length: 6 }).map((_, i) => (
            <line key={i} x1={122 + i * 16} y1="232" x2={122 + i * 16} y2="240" />
          ))}
        </g>

        {/* USB-C port */}
        <rect x="184" y="266" width="32" height="8" rx="3" fill="#050505" stroke="#2a2a2a" />

        {/* accent corner brackets */}
        <path d="M70 118V98a8 8 0 0 1 8-8h20" stroke="#FF5722" strokeWidth="2" fill="none" />
        <path d="M330 242v20a8 8 0 0 1-8 8h-20" stroke="#FF5722" strokeWidth="2" fill="none" />
      </g>

      {/* floating spec lines */}
      <line x1="330" y1="130" x2="372" y2="130" stroke="#2a2a2a" strokeWidth="1" strokeDasharray="2 3" />
      <line x1="70" y1="230" x2="30" y2="230" stroke="#2a2a2a" strokeWidth="1" strokeDasharray="2 3" />
    </svg>
  );
}
