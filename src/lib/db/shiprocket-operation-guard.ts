/** Durable lifecycle reservations that must serialize with cancellation/refund transitions. */
export const SHIPROCKET_ACTIVE_OPERATION_STATES = [
  "creating", "assigning_awb", "pickup_requesting", "generating_label",
] as const;

export const SHIPROCKET_UNRESOLVED_STATES = [
  ...SHIPROCKET_ACTIVE_OPERATION_STATES,
  "unknown", "awb_unknown", "pickup_unknown", "label_unknown",
] as const;

export function hasUnresolvedShiprocketOperation(state: string | null | undefined): boolean {
  return SHIPROCKET_UNRESOLVED_STATES.includes(state as (typeof SHIPROCKET_UNRESOLVED_STATES)[number]);
}
