"use client";

import React from "react";
import { OrderStatus } from "@/types";

interface StatusBadgeProps {
  status: OrderStatus | "active" | "inactive" | "published" | "draft" | "low_stock";
  className?: string;
}

export function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const styles: Record<string, { bg: string; text: string; label: string }> = {
    placed: { bg: "bg-blue-50 border-blue-200", text: "text-blue-800", label: "Order Placed" },
    confirmed: { bg: "bg-indigo-50 border-indigo-200", text: "text-indigo-800", label: "Confirmed" },
    processing: { bg: "bg-amber-50 border-amber-200", text: "text-amber-800", label: "Processing" },
    shipped: { bg: "bg-purple-50 border-purple-200", text: "text-purple-800", label: "In Transit" },
    delivered: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800", label: "Delivered" },
    cancelled: { bg: "bg-red-50 border-red-200", text: "text-red-800", label: "Cancelled" },
    active: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800", label: "Active" },
    inactive: { bg: "bg-neutral-100 border-neutral-200", text: "text-neutral-600", label: "Inactive" },
    published: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800", label: "Published" },
    draft: { bg: "bg-neutral-100 border-neutral-200", text: "text-neutral-700", label: "Draft" },
    low_stock: { bg: "bg-amber-50 border-amber-200", text: "text-amber-800", label: "Low Stock" },
  };

  const current = styles[status] || {
    bg: "bg-neutral-100 border-neutral-200",
    text: "text-neutral-700",
    label: status,
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 border text-[10px] uppercase font-bold tracking-wider ${current.bg} ${current.text} ${className}`}
    >
      {current.label}
    </span>
  );
}
