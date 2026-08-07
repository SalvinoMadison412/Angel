import * as SecureStore from "expo-secure-store";

// Whether LocationPermissionScreen has already been shown once (Allow or
// Not Now, either way). expo-secure-store rather than AsyncStorage — this
// project doesn't have AsyncStorage installed, and SecureStore is already
// the established pattern here for exactly this kind of local-only flag
// (see the same approach in OnboardingScreen for notification permission).
const LOCATION_PERMISSION_ASKED_KEY = "location_permission_asked";

export async function getLocationPermissionAsked(): Promise<boolean> {
  const value = await SecureStore.getItemAsync(LOCATION_PERMISSION_ASKED_KEY);
  return value === "true";
}

export async function setLocationPermissionAsked(): Promise<void> {
  await SecureStore.setItemAsync(LOCATION_PERMISSION_ASKED_KEY, "true");
}
