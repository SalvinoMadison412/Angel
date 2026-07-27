import { SubscriptionTier } from "../../types/database";

export interface PurchaseRequest {
  tier: SubscriptionTier;
  amountRupees: number;
}

export interface PurchaseResult {
  success: boolean;
  receiptId: string;
}

export interface PaymentProvider {
  purchase(request: PurchaseRequest): Promise<PurchaseResult>;
}
