# Legacy pending checkout reconciliation

`legacy-pending-checkout-reconciliation.sql` is a read-only report. Run it using a read-only database role and save the output to the change record. It does not modify records.

For each row, compare payment method and status with order references, payment-attempt rows, and audit events. For any Razorpay order or payment reference, confirm the final provider state and amount in Razorpay before deciding whether the checkout was abandoned. A capture or paid audit signal always requires manual reconciliation. Pending COD and Cash on Delivery rows are legitimate unpaid orders and must be preserved.

Only after a reviewer documents the evidence, the operator obtains separate production approval, and a backup is verified may the team archive a record. Retain the original row, order items, provider references, and audit history in an immutable archive; do not delete rows or rewrite payment history. This application change does not run this query or perform cleanup.
