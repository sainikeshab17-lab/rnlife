"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";

interface Review { id: string; product_id: string; user_id: string; order_item_id: string; rating: number; body: string; status: string; created_at: string; }

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/reviews", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load reviews.");
    setReviews(data.reviews ?? []);
  }, []);
  useEffect(() => { load().catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load reviews.")); }, [load]);

  const moderate = async (id: string, status: "approved" | "rejected") => {
    const response = await fetch("/api/admin/reviews", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, status }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Unable to update review."); return; }
    await load();
  };

  return <AdminLayout title="Product Reviews" subtitle="Review verified-purchase submissions before publication.">
    <div className="space-y-4">
      {error && <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {reviews.length === 0 && <p className="border border-neutral-200 bg-white p-6 text-sm text-neutral-600">No customer reviews have been submitted.</p>}
      {reviews.map((review) => <article key={review.id} className="border border-neutral-200 bg-white p-5 space-y-3">
        <div className="flex flex-wrap justify-between gap-2 text-xs"><strong>{review.product_id} · {review.rating}/5</strong><span>{review.status} · {new Date(review.created_at).toLocaleDateString()}</span></div>
        <p className="text-sm leading-relaxed">{review.body}</p>
        <p className="text-xs text-neutral-500">Verified order item {review.order_item_id}</p>
        {review.status === "pending" && <div className="flex gap-2"><button onClick={() => moderate(review.id, "approved")} className="bg-black px-4 py-2 text-xs font-bold text-white">Approve</button><button onClick={() => moderate(review.id, "rejected")} className="border px-4 py-2 text-xs font-bold">Reject</button></div>}
      </article>)}
    </div>
  </AdminLayout>;
}
