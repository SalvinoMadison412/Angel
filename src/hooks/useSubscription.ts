import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";
import { SubscriptionTier } from "../types/database";
import { paymentProvider } from "../services/payments";

export const PLAN_PRICES: Record<SubscriptionTier, number> = {
  3: 499,
  6: 899,
  12: 1499,
};

export function useCurrentSubscription() {
  const { session } = useAuth();
  const userId = session?.user.id;

  return useQuery({
    queryKey: ["subscription", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function usePurchaseSubscription() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tier: SubscriptionTier) => {
      const result = await paymentProvider.purchase({ tier, amountRupees: PLAN_PRICES[tier] });
      if (!result.success) throw new Error("Payment failed");

      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + tier);

      const { error } = await supabase.from("subscriptions").insert({
        user_id: userId,
        tier,
        start_date: startDate.toISOString().slice(0, 10),
        end_date: endDate.toISOString().slice(0, 10),
        status: "active",
      });
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subscription", userId] });
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    },
  });
}

export function daysLeft(expiry: string | null): number {
  if (!expiry) return 0;
  const diff = new Date(expiry).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
