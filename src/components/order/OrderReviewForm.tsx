"use client";

import { useState } from "react";

export function OrderReviewForm({ productId, orderItemId }: { productId: string; orderItemId: string }) {
  const [rating, setRating] = useState("5");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/reviews", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ productId, orderItemId, rating: Number(rating), body }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to submit review.");
      setStatus("Thanks. Your review is saved for moderation before it can appear publicly.");
      setBody("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to submit review.");
    } finally { setBusy(false); }
  };
  return <form onSubmit={submit} className="mt-3 max-w-xl space-y-2 border-t border-neutral-100 pt-3">
    <label className="block text-[10px] font-bold uppercase tracking-wider" htmlFor={`review-rating-${orderItemId}`}>Review this design</label>
    <div className="flex gap-2">
      <select id={`review-rating-${orderItemId}`} value={rating} onChange={(event) => setRating(event.target.value)} className="border border-neutral-300 px-2 text-xs" aria-label="Rating">
        {[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5</option>)}
      </select>
      <textarea value={body} onChange={(event) => setBody(event.target.value)} minLength={10} maxLength={2000} required rows={2} className="min-w-0 flex-1 border border-neutral-300 p-2 text-xs" placeholder="Share an honest note about this design." />
      <button type="submit" disabled={busy} className="self-start bg-black px-3 py-2 text-[10px] font-bold uppercase text-white disabled:opacity-50">{busy ? "Sending" : "Submit"}</button>
    </div>
    {status && <p role="status" className="text-xs text-neutral-600">{status}</p>}
  </form>;
}
