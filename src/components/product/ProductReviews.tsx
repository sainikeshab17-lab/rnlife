"use client";

import { useEffect, useState } from "react";

interface Review { rating: number; body: string; created_at: string; }
interface ReviewResponse { visible: boolean; count?: number; average?: number; reviews?: Review[]; }

export function ProductReviews({ productId }: { productId: string }) {
  const [data, setData] = useState<ReviewResponse | null>(null);
  useEffect(() => {
    let active = true;
    fetch(`/api/reviews?productId=${encodeURIComponent(productId)}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => { if (active && result?.visible && result.count >= 5) setData(result); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [productId]);

  if (!data?.visible || (data.count ?? 0) < 5) return null;
  return <section className="mt-12 border-t border-neutral-200 pt-8" aria-labelledby="product-reviews-heading">
    <h2 id="product-reviews-heading" className="text-xl font-black uppercase">Customer reviews</h2>
    <p className="mt-2 text-sm text-neutral-600">{data.average?.toFixed(1)} / 5 · {data.count} verified-purchase reviews</p>
    <div className="mt-5 space-y-4">{data.reviews?.map((review, index) => <article key={`${review.created_at}-${index}`} className="border-b border-neutral-100 pb-4">
      <p className="text-sm font-bold" aria-label={`${review.rating} out of 5 stars`}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>
      <p className="mt-2 text-sm leading-relaxed text-neutral-700">{review.body}</p>
    </article>)}</div>
  </section>;
}
