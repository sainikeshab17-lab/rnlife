export function hasRequiredOrderPayment(paymentMethod: string, paymentStatus: string, hasCapturedAdvance = false): boolean {
  if (paymentStatus === "paid") return true;
  return paymentMethod === "COD Advance" && paymentStatus === "partially_paid" && hasCapturedAdvance;
}

