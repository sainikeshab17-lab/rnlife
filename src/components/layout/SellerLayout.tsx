"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  Boxes,
  ArrowLeft,
  LogOut,
  Menu,
  X,
  ExternalLink,
  ShieldCheck,
  User,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";

interface SellerLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function SellerLayout({
  children,
  title,
  subtitle,
  actions,
}: SellerLayoutProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const navLinks = [
    { label: "Dashboard", href: "/seller", icon: LayoutDashboard },
    { label: "Products Catalog", href: "/seller/products", icon: Package },
    { label: "Add New T-Shirt", href: "/seller/products/new", icon: PlusCircle },
    { label: "Inventory Matrix", href: "/seller/inventory", icon: Boxes },
  ];

  return (
    <div className="min-h-screen bg-[#F6F8FB] text-[#111111] flex flex-col">
      {/* Top Staff Bar */}
      <header className="bg-[#111111] text-white border-b border-neutral-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
              className="p-1.5 text-neutral-400 hover:text-white lg:hidden"
              aria-label="Toggle navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm tracking-widest text-[#B8FF3B]">
                RIGHTNOWLIFE
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-neutral-800 text-neutral-300">
                STAFF SELLER PORTAL
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <Link
              href="/"
              target="_blank"
              className="text-neutral-300 hover:text-white flex items-center gap-1 hidden sm:flex"
            >
              <span>View Storefront</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>

            <Link
              href="/admin"
              className="text-neutral-300 hover:text-[#B8FF3B] flex items-center gap-1"
            >
              <span>Switch to Admin</span>
            </Link>

            <div className="flex items-center gap-2 pl-2 border-l border-neutral-700">
              <span className="font-semibold hidden sm:inline">{user?.name || "Devika Rao"}</span>
              <button
                onClick={logout}
                className="text-neutral-400 hover:text-red-400 p-1"
                aria-label="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Portal Workspace */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Nav (Desktop 3 cols) */}
        <aside
          className={`lg:col-span-3 ${
            isMobileNavOpen
              ? "fixed inset-0 z-50 bg-black/60 lg:relative lg:bg-transparent"
              : "hidden lg:block"
          }`}
        >
          <div className="bg-white border border-neutral-200 p-4 space-y-1 shadow-sm h-full max-w-xs lg:max-w-none">
            <div className="flex items-center justify-between lg:hidden pb-3 mb-2 border-b border-neutral-200">
              <span className="text-xs font-bold uppercase tracking-wider">Navigation</span>
              <button onClick={() => setIsMobileNavOpen(false)}>
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>

            <p className="px-3 text-[10px] uppercase tracking-wider font-bold text-neutral-400 mb-2">
              Catalog Management
            </p>

            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileNavOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                    isActive
                      ? "bg-black text-white"
                      : "text-neutral-700 hover:bg-neutral-100 hover:text-black"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}

            <div className="pt-6 mt-6 border-t border-neutral-200 space-y-2">
              <p className="px-3 text-[10px] uppercase tracking-wider font-bold text-neutral-400">
                Staff Information
              </p>
              <div className="px-3 text-xs text-neutral-600">
                <p className="font-bold text-black">{user?.name || "Staff Member"}</p>
                <p className="text-[11px] text-neutral-400 truncate">{user?.email}</p>
                <span className="inline-block mt-1 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Authorized Seller
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Content Area (9 cols) */}
        <main className="lg:col-span-9 space-y-6">
          {/* Header Row */}
          <div className="bg-white border border-neutral-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <span className="text-[10px] uppercase font-mono tracking-widest text-neutral-500 font-bold block mb-1">
                RIGHTNOWLIFE INTERNAL OPERATIONS
              </span>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight font-editorial">
                {title}
              </h1>
              {subtitle && <p className="text-xs text-neutral-600 mt-0.5">{subtitle}</p>}
            </div>

            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>

          {children}
        </main>
      </div>
    </div>
  );
}
