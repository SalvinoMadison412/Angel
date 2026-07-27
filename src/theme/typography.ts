export const fontFamily = {
  headingBold: "SpaceMono_700Bold",
  headingRegular: "SpaceMono_400Regular",
  monoRegular: "JetBrainsMono_400Regular",
  monoMedium: "JetBrainsMono_500Medium",
  monoBold: "JetBrainsMono_700Bold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemiBold: "Inter_600SemiBold",
} as const;

export const type = {
  wordmark: { fontFamily: fontFamily.headingBold, fontSize: 22, letterSpacing: 6 },
  display: { fontFamily: fontFamily.headingBold, fontSize: 34, lineHeight: 40 },
  statValue: { fontFamily: fontFamily.headingBold, fontSize: 30 },
  kicker: {
    fontFamily: fontFamily.monoMedium,
    fontSize: 11,
    letterSpacing: 2,
    textTransform: "uppercase" as const,
  },
  label: { fontFamily: fontFamily.monoRegular, fontSize: 12, letterSpacing: 0.5 },
  button: {
    fontFamily: fontFamily.monoBold,
    fontSize: 13,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  body: { fontFamily: fontFamily.body, fontSize: 15, lineHeight: 22 },
  bodySmall: { fontFamily: fontFamily.body, fontSize: 13, lineHeight: 18 },
  title: { fontFamily: fontFamily.headingBold, fontSize: 22 },
} as const;
