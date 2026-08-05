import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0A",
        "bg-elevated": "#111111",
        "bg-raised": "#161616",
        ink: "#FFFFFF",
        "ink-muted": "#9A9A9A",
        "ink-dim": "#6B6B6B",
        accent: "#FF5722",
        "accent-hover": "#FF7043",
        success: "#3DDC97",
        danger: "#FF5722",
      },
      backgroundColor: {
        "glass-fill": "rgba(255, 255, 255, 0.04)",
        "glass-fill-raised": "rgba(255, 255, 255, 0.06)",
      },
      borderColor: {
        glass: "rgba(255, 255, 255, 0.1)",
        divider: "rgba(255, 255, 255, 0.08)",
        "accent-border": "rgba(255, 87, 34, 0.5)",
      },
      fontFamily: {
        mono: ["var(--font-jetbrains-mono)", "monospace"],
        heading: ["var(--font-dm-serif)", "serif"],
        "heading-mono": ["var(--font-space-mono)", "monospace"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      letterSpacing: {
        widest2: "0.2em",
        widest3: "0.3em",
      },
      maxWidth: {
        container: "1280px",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 1px rgba(255,87,34,0.55), 0 0 12px 0 rgba(255,87,34,0.25)" },
          "50%": { boxShadow: "0 0 0 1px rgba(255,87,34,0.85), 0 0 22px 4px rgba(255,87,34,0.45)" },
        },
      },
      animation: {
        marquee: "marquee 30s linear infinite",
        "glow-pulse": "glow-pulse 2.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
