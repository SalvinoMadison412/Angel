export const colors = {
  bg: "#0A0A0A",
  bgElevated: "#111111",

  text: "#FFFFFF",
  textMuted: "#9A9A9A",
  textDim: "#6B6B6B",

  accent: "#FF5722",
  accentMuted: "rgba(255, 87, 34, 0.16)",
  accentBorder: "rgba(255, 87, 34, 0.5)",

  glassFill: "rgba(255, 255, 255, 0.04)",
  glassFillRaised: "rgba(255, 255, 255, 0.06)",
  glassBorder: "rgba(255, 255, 255, 0.1)",

  divider: "rgba(255, 255, 255, 0.08)",
  dotGrid: "rgba(255, 255, 255, 0.07)",

  success: "#3DDC97",
  danger: "#FF5722",

  overlay: "rgba(10, 10, 10, 0.82)",
} as const;

export const severityColor = (severity: number): string => {
  if (severity <= 2) return "#FFFFFF";
  if (severity === 3) return "#FFB020";
  return colors.accent;
};
