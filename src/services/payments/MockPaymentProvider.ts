import { PaymentProvider, PurchaseRequest, PurchaseResult } from "./PaymentProvider";

/**
 * Stands in for a real gateway. Later, replace with a Supabase Edge Function
 * that creates a Razorpay/Stripe order, and have this resolve only after the
 * client-side checkout SDK confirms payment — the SubscriptionScreen only
 * depends on the PaymentProvider interface, so that swap is contained here.
 */
export class MockPaymentProvider implements PaymentProvider {
  async purchase(request: PurchaseRequest): Promise<PurchaseResult> {
    await new Promise((resolve) => setTimeout(resolve, 900));
    return {
      success: true,
      receiptId: `mock_${request.tier}mo_${Date.now()}`,
    };
  }
}
