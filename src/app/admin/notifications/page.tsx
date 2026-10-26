"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Send,
  Search,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { DbNotificationJob } from "@/lib/db/index";

export default function AdminNotificationsPage() {
  const [jobs, setJobs] = useState<DbNotificationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/notifications");
      if (!res.ok) throw new Error("Failed to load notification jobs.");
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleRetry = async (jobId: string) => {
    setRetryingId(jobId);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Retry failed.");
      }

      const data = await res.json();
      await fetchJobs();
      alert(data.alreadySent
        ? "This notification was already accepted previously. No duplicate was sent."
        : data.providerAccepted
          ? `${data.result?.provider === "twilio" ? "WhatsApp" : "Email"} accepted by the provider. Delivery is not confirmed; check the job status.`
          : data.message || "Retry did not send the notification. Review the job status and error details.");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRetryingId(null);
    }
  };

  const filteredJobs = jobs.filter((job) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      job.recipient_email.toLowerCase().includes(q) ||
      (job.recipient_phone?.toLowerCase().includes(q) ?? false) ||
      job.event_type.toLowerCase().includes(q) ||
      job.subject.toLowerCase().includes(q) ||
      (job.order_id && job.order_id.toLowerCase().includes(q))
    );
  });

  return (
    <AdminLayout
      title="Notification Queue & Transactional Logs"
      subtitle="Persistent transactional email jobs, delivery attempts, idempotency keys, and manual retry controls."
      actions={
        <button
          onClick={fetchJobs}
          className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Search */}
        <div className="bg-white border border-neutral-200 p-4 shadow-sm flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recipient, event type, or subject..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-neutral-300 focus:border-black outline-none"
            />
          </div>
          <span className="text-xs text-neutral-500 font-mono">
            {filteredJobs.length} {filteredJobs.length === 1 ? "Job" : "Jobs"}
          </span>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white border border-neutral-200 p-12 text-center shadow-sm">
            <Loader2 className="w-8 h-8 animate-spin text-neutral-400 mx-auto mb-3" />
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              Loading notification jobs...
            </p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 p-6 text-red-700 text-xs shadow-sm">
            <p className="font-bold uppercase tracking-wider mb-1">Error</p>
            <p>{error}</p>
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="bg-white border border-neutral-200 p-12 text-center shadow-sm">
            <FileText className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
              No notification jobs recorded in database
            </p>
          </div>
        ) : (
          <div className="bg-white border border-neutral-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-neutral-200">
              <thead className="bg-neutral-50 text-neutral-500 uppercase tracking-wider text-[10px] font-bold">
                <tr>
                  <th className="px-4 py-3">Event / Job ID</th>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Attempts</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#111111] uppercase tracking-wide">
                        {job.event_type}
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono">{job.id}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#111111]">{job.recipient_name || "Customer"}</div>
                      <div className="text-neutral-500 font-mono text-[11px]">{job.channel === "whatsapp" ? job.recipient_phone : job.recipient_email}</div>
                    </td>
                    <td className="px-4 py-3 text-neutral-800 max-w-xs truncate">
                      {job.channel === "whatsapp" ? "WhatsApp order confirmation" : job.subject}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] uppercase font-bold ${
                          job.status === "sent"
                            ? "bg-emerald-100 text-emerald-800"
                            : job.status === "skipped"
                            ? "bg-neutral-100 text-neutral-700"
                            : job.status === "failed"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {job.status === "sent" ? "accepted by provider" : job.status}
                      </span>
                      {job.last_error && (
                        <p className="text-[10px] text-red-600 mt-0.5 truncate max-w-xs" title={job.last_error}>
                          {job.last_error}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-neutral-600">
                      {job.attempts} / {job.max_attempts}
                    </td>
                    <td className="px-4 py-3 text-neutral-400 font-mono text-[11px]">
                      {new Date(job.created_at).toLocaleString("en-IN", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {job.status === "unknown" ? (
                        <span className="text-[10px] text-red-700">Reconcile in Resend</span>
                      ) : job.status !== "sent" && (
                        <button
                          onClick={() => handleRetry(job.id)}
                          disabled={retryingId === job.id}
                          className="px-2.5 py-1 bg-neutral-800 hover:bg-black text-white text-[10px] uppercase font-bold tracking-wider disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          <Send className="w-2.5 h-2.5" />
                          <span>{retryingId === job.id ? "Retrying..." : "Retry"}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
