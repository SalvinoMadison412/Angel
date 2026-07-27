import { MockPaymentProvider } from "./MockPaymentProvider";

export * from "./PaymentProvider";
export * from "./MockPaymentProvider";

export const paymentProvider = new MockPaymentProvider();
