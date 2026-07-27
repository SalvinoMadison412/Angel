import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { Responder, ResponderType } from "../types/database";

export function useResponders(types?: ResponderType[]) {
  return useQuery({
    queryKey: ["responders", types?.join(",") ?? "all"],
    queryFn: async (): Promise<Responder[]> => {
      let query = supabase.from("responders").select("*").eq("available", true);
      if (types && types.length > 0) query = query.in("type", types);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Severity 1–3 -> nearest two-wheeler gig partner. Severity 4–5 -> car/auto/Uber. */
export function responderTypesForSeverity(severity: number): ResponderType[] {
  return severity <= 3 ? ["gig_partner"] : ["auto", "car_uber"];
}
