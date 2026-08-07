import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";

// @react-native-firebase/app auto-initializes from the native
// google-services.json at app startup — nothing to call here. See
// docs/FIREBASE_SETUP.md for the one-time console setup this depends on.

export type ConfirmationResult = FirebaseAuthTypes.ConfirmationResult;

/** Kicks off Firebase phone auth — triggers the SMS containing the OTP. */
export function sendFirebaseOtp(fullPhoneNumber: string): Promise<ConfirmationResult> {
  return auth().signInWithPhoneNumber(fullPhoneNumber);
}

/** Confirms the OTP and returns the Firebase ID token for the newly signed-in user. */
export async function confirmFirebaseOtp(
  confirmation: ConfirmationResult,
  code: string
): Promise<string> {
  const credential = await confirmation.confirm(code);
  if (!credential?.user) throw new Error("Firebase did not return a signed-in user");
  return credential.user.getIdToken();
}
