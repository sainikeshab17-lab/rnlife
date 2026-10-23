"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User,
  Package,
  MapPin,
  Heart,
  LogOut,
} from "lucide-react";
import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { useAuth } from "@/context/auth-context";

interface AccountLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AccountLayout({ children, title, subtitle }: AccountLayoutProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const links = [
    { label: "Account Overview", href: "/account", icon: User },
    { label: "My Orders & Tracking", href: "/account/orders", icon: Package },
    { label: "Saved Addresses", href: "/account/addresses", icon: MapPin },
    { label: "Wishlist", href: "/account/wishlist", icon: Heart },
  ];

  return (
    <StoreLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Breadcrumbs
          items={[
            { label: "Account", href: "/account" },
            { label: title },
          ]}
        />

        <div className="pt-4 pb-8 border-b border-neutral-200 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[11px] uppercase tracking-widest font-mono text-neutral-500 font-bold block mb-1">
              CUSTOMER DASHBOARD
            </span>
            <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight font-editorial">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-neutral-600 mt-1">{subtitle}</p>
            )}
          </div>

          <div className="text-xs text-neutral-500 font-mono">
            Signed in as: <strong className="text-black">{user?.name || user?.email || "Customer"}</strong>
          </div>
        </div>

        {/* 2-Column Dashboard Stage */}
        <div className="pt-8 pb-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
          {/* Navigation Sidebar (3 cols) */}
          <aside className="lg:col-span-3">
            <div className="border border-neutral-200 bg-white p-4 space-y-1 shadow-sm">
              <div className="p-3 bg-[#FFFFFF] border border-neutral-200 mb-3">
                <p className="text-xs font-bold uppercase truncate text-black">{user?.name}</p>
                <p className="text-[11px] text-neutral-500 truncate">{user?.email}</p>
                <span className="inline-block mt-1 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-neutral-200 text-neutral-700">
                  Customer Account
                </span>
              </div>

              {links.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
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

              <div className="pt-4 mt-4 border-t border-neutral-200 space-y-1">
                <button
                  onClick={logout}
                  className="flex items-center gap-2.5 w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 font-bold uppercase tracking-wider pt-3"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </div>
          </aside>

          {/* Main Dashboard Content (9 cols) */}
          <main className="lg:col-span-9">{children}</main>
        </div>
      </div>
    </StoreLayout>
  );
}
