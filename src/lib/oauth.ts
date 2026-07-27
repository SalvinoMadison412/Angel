import { makeRedirectUri } from "expo-auth-session";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "./supabase";

// Required on web so the auth popup closes itself after redirecting back;
// a no-op on native. See https://docs.expo.dev/versions/v57.0.0/sdk/auth-session/
WebBrowser.maybeCompleteAuthSession();

// Picks up app.json's "scheme": "angel" automatically, producing
// angel://redirect (or the Expo dev-client equivalent). OAuth redirects
// need a custom scheme, which Expo Go can't register — this flow only
// completes in a development build or standalone app.
export const oauthRedirectTo = makeRedirectUri();

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
