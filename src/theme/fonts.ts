import { useFonts as useSpaceMono, SpaceMono_400Regular, SpaceMono_700Bold } from "@expo-google-fonts/space-mono";
import {
  useFonts as useJetBrainsMono,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";
import { useFonts as useInter, Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from "@expo-google-fonts/inter";

export function useAppFonts() {
  const [spaceMonoLoaded] = useSpaceMono({ SpaceMono_400Regular, SpaceMono_700Bold });
  const [jetBrainsMonoLoaded] = useJetBrainsMono({
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });
  const [interLoaded] = useInter({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold });

  return spaceMonoLoaded && jetBrainsMonoLoaded && interLoaded;
}
