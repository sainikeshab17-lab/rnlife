-- READ ONLY: classify old pending rows before any separately approved cleanup.
-- This query deliberately returns evidence and a suggested review bucket only.
-- It never updates, archives, or deletes records.
WITH attempt_evidence AS (
  SELECT order_id,
         COUNT(*) AS attempt_count,
         COUNT(*) FILTER (WHERE payment_state = 'captured') AS captured_attempt_count,
         STRING_AGG(DISTINCT payment_state, ', ' ORDER BY payment_state) AS payment_states,
         STRING_AGG(DISTINCT amount_paisa::TEXT, ', ' ORDER BY amount_paisa::TEXT) AS attempt_amount_paisa,
         STRING_AGG(DISTINCT razorpay_order_id, ', ') FILTER (WHERE razorpay_order_id IS NOT NULL) AS provider_order_ids,
         STRING_AGG(DISTINCT razorpay_payment_id, ', ') FILTER (WHERE razorpay_payment_id IS NOT NULL) AS provider_payment_ids
  FROM razorpay_payment_attempts
  GROUP BY order_id
), audit_evidence AS (
  SELECT order_id,
         COUNT(*) FILTER (WHERE event_type ILIKE '%captur%' OR event_type ILIKE '%paid%') AS capture_or_paid_audit_count,
         STRING_AGG(DISTINCT event_type, ', ' ORDER BY event_type) AS audit_events
  FROM payment_audits
  WHERE order_id IS NOT NULL
  GROUP BY order_id
)
SELECT o.id,
       o.order_number,
       o.created_at,
       o.customer_email,
       o.payment_method,
       o.payment_status,
       o.order_status,
       o.total AS total_rupees,
       ROUND(o.total * 100)::BIGINT AS total_paisa,
       o.razorpay_order_id AS order_provider_order_id,
       o.razorpay_payment_id AS order_provider_payment_id,
       COALESCE(a.attempt_count, 0) AS payment_attempt_count,
       COALESCE(a.captured_attempt_count, 0) AS captured_attempt_count,
       a.payment_states,
       a.attempt_amount_paisa,
       a.provider_order_ids,
       a.provider_payment_ids,
       COALESCE(e.capture_or_paid_audit_count, 0) AS capture_or_paid_audit_count,
       e.audit_events,
       CASE
         WHEN UPPER(o.payment_method) IN ('COD', 'CASH ON DELIVERY') THEN 'preserve_cod_pending'
         WHEN o.payment_status NOT IN ('pending_payment', 'pending_advance') THEN 'not_a_pending_checkout'
         WHEN COALESCE(a.captured_attempt_count, 0) > 0
           OR COALESCE(e.capture_or_paid_audit_count, 0) > 0
           OR o.razorpay_payment_id IS NOT NULL THEN 'captured_or_paid_evidence_manual_reconcile'
         WHEN o.razorpay_order_id IS NOT NULL OR COALESCE(a.attempt_count, 0) > 0 THEN 'provider_attempt_exists_check_provider_before_classifying'
         ELSE 'no_provider_reference_candidate_only_check_audit_and_provider_first'
       END AS review_bucket
FROM orders o
LEFT JOIN attempt_evidence a ON a.order_id = o.id
LEFT JOIN audit_evidence e ON e.order_id = o.id
WHERE o.payment_status IN ('pending_payment', 'pending_advance')
ORDER BY o.created_at, o.order_number;
