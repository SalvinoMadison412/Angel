import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";

// Required on web so the auth popup closes itself after redirecting back;
// a no-op on native. See https://docs.expo.dev/versions/v57.0.0/sdk/auth-session/
WebBrowser.maybeCompleteAuthSession();

// Hardcoded rather than makeRedirectUri(): when the JS bundle is loaded
// through a running Metro dev server (true even in a dev-client build, not
// just Expo Go), makeRedirectUri() resolves against the dev server's own
// host instead of the app's native scheme — e.g. exp://10.0.2.2:8081 on the
// Android emulator — so it never matches Supabase's allow-listed redirect.
// This value must also be added to Supabase Dashboard → Authentication →
// URL Configuration → Redirect URLs, or Supabase falls back to the
// project's Site URL (localhost:3000 by default) instead of honoring it.
// OAuth redirects need a custom scheme, which Expo Go can't register —
// this flow only completes in a development build or standalone app.
export const oauthRedirectTo = "angel://auth/callback";

export async function createSessionFromUrl(url: string) {
  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(errorCode);

  const { access_token, refresh_token } = params;
  if (!access_token || !refresh_token) return null;

  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return data.session;
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: oauthRedirectTo,
      skipBrowserRedirect: true,
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Supabase did not return an OAuth URL");

  const result = await WebBrowser.openAuthSessionAsync(data.url, oauthRedirectTo);
  if (result.type === "success") {
    await createSessionFromUrl(result.url);
  }
  return result;
}
