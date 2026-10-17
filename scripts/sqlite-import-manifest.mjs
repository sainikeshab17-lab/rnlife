export const TABLES = [
  { name: "orders", key: ["id"], columns: ["id", "order_number", "customer_name", "customer_email", "customer_phone", "subtotal", "shipping", "discount", "total", "payment_method", "payment_status", "order_status", "razorpay_order_id", "razorpay_payment_id", "razorpay_signature", "guest_token", "user_id", "courier_name", "tracking_number", "tracking_url", "notes", "cancelled_reason", "refund_status", "refund_id", "dispatch_date", "estimated_delivery_date", "actual_delivery_date", "cancellation_requested", "cancellation_requested_at", "cancellation_reason", "created_at", "updated_at"] },
  { name: "order_items", key: ["id"], columns: ["id", "order_id", "product_id", "product_slug", "product_name", "color", "size", "price", "quantity", "image", "sku", "fit"] },
  { name: "order_addresses", key: ["id"], columns: ["id", "order_id", "full_name", "phone", "address_line1", "address_line2", "landmark", "city", "state", "pin_code", "country"] },
  { name: "inventory", key: ["product_id", "size"], columns: ["product_id", "size", "stock", "reserved"] },
  { name: "payment_audits", key: ["id"], columns: ["id", "order_id", "event_type", "payload", "created_at"] },
  { name: "order_status_history", key: ["id"], columns: ["id", "order_id", "from_status", "to_status", "actor", "note", "created_at"] },
  { name: "admin_users", key: ["id"], columns: ["id", "email", "name", "password_hash", "role", "is_active", "created_at", "updated_at"] },
  { name: "admin_sessions", key: ["id"], columns: ["id", "admin_id", "token_hash", "expires_at", "created_at", "ip_address", "user_agent"] },
  { name: "inventory_adjustments", key: ["id"], columns: ["id", "product_id", "size", "prev_stock", "new_stock", "delta", "reason", "actor", "created_at"] },
  { name: "audit_logs", key: ["id"], columns: ["id", "actor", "action", "entity_type", "entity_id", "before_value", "after_value", "metadata", "ip_address", "created_at"] },
  { name: "product_overrides", key: ["product_id"], columns: ["product_id", "is_active", "custom_description", "updated_by", "updated_at"] },
  { name: "shipping_events", key: ["id"], columns: ["id", "order_id", "status", "location", "description", "courier_name", "tracking_number", "occurred_at", "created_at"] },
  { name: "returns", key: ["id"], columns: ["id", "order_id", "return_number", "customer_email", "type", "status", "reason", "customer_notes", "admin_notes", "inspection_result", "inspection_notes", "restocked", "exchange_item_id", "exchange_size", "created_at", "updated_at", "customer_note", "admin_note", "resolution_type", "refund_amount"] },
  { name: "return_items", key: ["id"], columns: ["id", "return_id", "order_item_id", "product_id", "product_name", "size", "color", "quantity", "price", "product_slug", "requested_exchange_size", "condition", "restocked", "created_at"] },
  { name: "refund_records", key: ["id"], columns: ["id", "order_id", "return_id", "razorpay_payment_id", "razorpay_refund_id", "amount", "amount_paisa", "currency", "status", "reason", "idempotency_key", "raw_response", "created_at", "updated_at", "initiated_by", "failure_reason"] },
  {
    name: "notification_jobs",
    key: ["id"],
    columns: ["id", "order_id", "event_type", "recipient_email", "recipient_name", "subject", "body_html", "body_text", "status", "provider", "provider_message_id", "attempts", "max_attempts", "last_error", "idempotency_key", "created_at", "updated_at"],
    map(row) {
      return {
        ...row,
        body_html: row.html_content,
        body_text: null,
        attempts: row.retry_count,
        max_attempts: row.max_retries,
      };
    },
  },
];

export const FOREIGN_KEYS = [
  ["order_items", "order_id", "orders", "id"],
  ["order_addresses", "order_id", "orders", "id"],
  ["order_status_history", "order_id", "orders", "id"],
  ["admin_sessions", "admin_id", "admin_users", "id"],
  ["shipping_events", "order_id", "orders", "id"],
  ["returns", "order_id", "orders", "id"],
  ["return_items", "return_id", "returns", "id"],
  ["refund_records", "order_id", "orders", "id"],
];
