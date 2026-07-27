import * as SecureStore from "expo-secure-store";

/**
 * Supabase's auth-js storage adapter shape: get/set/removeItem, string in, string out.
 * expo-secure-store keeps this in the Android Keystore.
 *
 * Caveat: SecureStore caps a value at ~2048 bytes on Android. A phone-auth
 * session (access + refresh token, minimal user metadata) comfortably fits;
 * if profile metadata grows a lot later, swap this for an encrypted
 * AsyncStorage blob (SecureStore holding only the encryption key).
 */
export const secureSessionStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};
