"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Search,
  Filter,
  RefreshCcw,
  Loader2,
  ShieldCheck,
  User,
  Clock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { DbAuditLog } from "@/lib/db/index";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<DbAuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState("all");
  const [actorSearch, setActorSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 25;

  const fetchLogs = async (targetPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", limit.toString());
      params.set("offset", ((targetPage - 1) * limit).toString());
      if (entityFilter !== "all") params.set("entity_type", entityFilter);
      if (actorSearch.trim()) params.set("actor", actorSearch.trim());

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load audit logs");
      const data = await res.json();
      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setPage(targetPage);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(1);
  }, [entityFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchLogs(1);
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <AdminLayout
      title="System Audit Trail & Security Logs"
      subtitle="Immutable chronological ledger of all administrative actions, inventory adjustments, and status transitions."
      actions={
        <button
          onClick={() => fetchLogs(page)}
          disabled={loading}
          className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-xs font-bold uppercase tracking-wider text-neutral-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      }
    >
      <div className="bg-white border border-neutral-200 shadow-sm space-y-4">
        {/* Filters */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="text"
              value={actorSearch}
              onChange={(e) => setActorSearch(e.target.value)}
              placeholder="Filter by actor email..."
              className="px-3 py-2 text-xs border border-neutral-300 focus:border-black outline-none font-medium w-full sm:w-64"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-black text-white text-xs font-bold uppercase cursor-pointer"
            >
              Filter
            </button>
          </form>

          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold text-neutral-500">Entity:</span>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="px-3 py-2 border border-neutral-300 text-xs font-bold uppercase bg-white outline-none cursor-pointer"
            >
              <option value="all">All Entities</option>
              <option value="order">Order Actions</option>
              <option value="inventory">Inventory Adjustments</option>
              <option value="product">Product Catalog</option>
              <option value="admin_session">Authentication Events</option>
            </select>
          </div>
        </div>

        {/* Logs Table */}
        {loading ? (
          <div className="py-16 text-center text-neutral-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-neutral-400" />
            <p className="text-xs font-bold uppercase tracking-wider">Reading immutable audit records...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-neutral-400 space-y-2">
            <FileText className="w-8 h-8 mx-auto text-neutral-300" />
            <p className="text-xs font-bold uppercase tracking-wider">No Audit Records Found</p>
            <p className="text-[11px] text-neutral-500">Actions taken by administrators will appear here.</p>
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-neutral-700 uppercase font-bold text-[11px]">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Entity</th>
                    <th className="py-3 px-4">Before / After Snapshot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 font-medium font-mono text-[11px]">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-neutral-50 transition-colors">
                      <td className="py-3 px-4 text-neutral-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("en-IN")}
                      </td>

                      <td className="py-3 px-4 text-neutral-900 font-bold font-sans">
                        {log.actor}
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-neutral-100 border border-neutral-300 text-neutral-800 font-bold uppercase text-[10px]">
                          {log.action}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-neutral-600">
                        <span className="uppercase text-[10px] text-neutral-400 block font-sans">
                          {log.entity_type}
                        </span>
                        {log.entity_id || "—"}
                      </td>

                      <td className="py-3 px-4 text-neutral-700 max-w-xs truncate">
                        {log.before_value || log.after_value ? (
                          <div className="space-y-0.5 text-[10px]">
                            {log.before_value && (
                              <span className="text-red-700 block truncate">
                                Before: {log.before_value}
                              </span>
                            )}
                            {log.after_value && (
                              <span className="text-emerald-700 block truncate">
                                After: {log.after_value}
                              </span>
                            )}
                          </div>
                        ) : log.metadata ? (
                          <span className="text-neutral-500 truncate block">{log.metadata}</span>
                        ) : (
                          <span className="text-neutral-400 italic font-sans">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Bar */}
            <div className="p-4 border-t border-neutral-200 flex items-center justify-between text-xs">
              <span className="text-neutral-500">
                Total audit entries: <strong>{total}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => fetchLogs(page - 1)}
                  className="px-2.5 py-1 border border-neutral-300 text-neutral-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Prev</span>
                </button>
                <span className="px-2 font-mono font-bold">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => fetchLogs(page + 1)}
                  className="px-2.5 py-1 border border-neutral-300 text-neutral-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
