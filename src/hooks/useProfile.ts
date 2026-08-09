import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { File } from "expo-file-system";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import { Profile } from "../types/database";

const AVATAR_BUCKET = "avatars";

export function useProfile() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["profile", userId] });

  const query = useQuery({
    queryKey: ["profile", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Advances the resume pointer as the rider completes (or explicitly
  // skips) each onboarding step — see Profile.onboarding_step.
  const setOnboardingStep = useMutation({
    mutationFn: async (step: number) => {
      const { error } = await supabase.from("profiles").update({ onboarding_step: step }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const completeOnboarding = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ onboarding_completed: true }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const save = useMutation({
    mutationFn: async (input: { name: string; phone: string }) => {
      const { error } = await supabase.from("profiles").update({ name: input.name, phone: input.phone }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  // Overwrites the same object path every time (`{userId}/avatar.<ext>`)
  // rather than generating a new one per upload — keeps the bucket from
  // accumulating an old photo per rider on every re-upload, and storage
  // RLS (see migration 0015) is keyed on that same first path segment
  // being the uploader's own auth.uid(). A cache-busting query param is
  // appended to the stored URL so the new photo actually shows up
  // immediately instead of the CDN/RN Image cache serving the old bytes
  // from the same URL.
  const uploadAvatar = useMutation({
    mutationFn: async (localUri: string) => {
      if (!userId) throw new Error("Not signed in");
      const extMatch = /\.(\w+)$/.exec(localUri.split("?")[0]);
      const ext = (extMatch?.[1] ?? "jpg").toLowerCase();
      const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      const path = `${userId}/avatar.${ext}`;

      const bytes = await new File(localUri).arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, bytes, { contentType, upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicUrl } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      const avatarUrl = `${publicUrl.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userId);
      if (updateError) throw updateError;

      return avatarUrl;
    },
    onSuccess: invalidate,
  });

  return { ...query, setOnboardingStep, completeOnboarding, save, uploadAvatar };
}
