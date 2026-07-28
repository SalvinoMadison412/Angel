import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import { Device } from "../types/database";

export function useDevice() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["device", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<Device | null> => {
      const { data, error } = await supabase
        .from("devices")
        .select("*")
        .eq("owner_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const ensureDevice = useMutation({
    mutationFn: async (): Promise<Device> => {
      if (query.data) return query.data;
      const { data, error } = await supabase
        .from("devices")
        .insert({ owner_id: userId, pairing_status: "pairing" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["device", userId] }),
  });

  const saveCalibration = useMutation({
    mutationFn: async (offsets: { x: number; y: number; z: number }) => {
      if (!query.data) throw new Error("No device to calibrate");
      const { error } = await supabase
        .from("devices")
        .update({
          calibration_offset_x: offsets.x,
          calibration_offset_y: offsets.y,
          calibration_offset_z: offsets.z,
          pairing_status: "paired",
        })
        .eq("id", query.data.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["device", userId] }),
  });

  const setCalibrated = useMutation({
    mutationFn: async (calibrated: boolean) => {
      if (!query.data) throw new Error("No device to update");
      const { error } = await supabase.from("devices").update({ calibrated }).eq("id", query.data.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["device", userId] }),
  });

  return { ...query, ensureDevice, saveCalibration, setCalibrated };
}
