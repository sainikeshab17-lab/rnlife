"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  User,
  Heart,
  ShoppingBag,
  Menu,
  X,
  ChevronDown,
  LayoutDashboard,
  ShieldAlert,
  Package,
  LogOut,
  MapPin,
} from "lucide-react";
import { useCart } from "@/context/cart-context";
import { useWishlist } from "@/context/wishlist-context";
import { useAuth } from "@/context/auth-context";
import { SearchModal } from "@/components/common/SearchModal";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { AnnouncementBar } from "./AnnouncementBar";
import { BrandLogo } from "@/components/common/BrandLogo";

export function Navbar() {
  const pathname = usePathname();
  const { itemCount, openDrawer } = useCart();
  const { itemCount: wishlistCount } = useWishlist();
  const { user, isAuthenticated, logout } = useAuth();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileMenuPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      mobileMenuPanelRef.current?.querySelector<HTMLElement>("button, a[href]")?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
        return;
      }
      if (event.key !== "Tab" || !mobileMenuPanelRef.current) return;
      const focusable = Array.from(mobileMenuPanelRef.current.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [isMobileMenuOpen]);

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    mobileMenuTriggerRef.current?.focus();
  };

  const navLinks = [
    { label: "Shop All", href: "/shop" },
    { label: "Graphic Tees", href: "/collections/graphic-tees" },
    { label: "Oversized", href: "/collections/oversized-tees" },
    { label: "Essentials", href: "/collections/essentials" },
    { label: "New Drops", href: "/collections/new-drops" },
  ];

  return (
    <>
      <AnnouncementBar />

      <header
        className={`sticky top-0 z-40 w-full transition-all duration-200 ${
          isScrolled
            ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-[#E5E5E5]"
            : "bg-white border-b border-[#E5E5E5]"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 md:h-16">
            {/* Mobile Menu Trigger */}
            <div className="flex items-center lg:hidden">
              <button
                ref={mobileMenuTriggerRef}
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-1.5 -ml-1.5 text-neutral-800 hover:text-black transition-colors"
                aria-label="Open mobile navigation"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>

            {/* Brand Logo with 4-Color RN Emblem */}
            <div className="flex-1 lg:flex-none flex items-center justify-center lg:justify-start">
              <BrandLogo size="md" />
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center space-x-5">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`nav-link text-[10px] uppercase tracking-wider font-bold py-1 ${
                      isActive
                        ? "text-[#111111] active"
                        : "text-[#858585] hover:text-[#111111]"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Header Right Action Icons */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Search Trigger */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 text-neutral-700 hover:text-black hover:bg-neutral-100 rounded-full transition-colors"
                aria-label="Search catalog"
              >
                <Search className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>

              {/* Wishlist Icon */}
              <Link
                href="/account/wishlist"
                className="p-2 text-neutral-700 hover:text-black hover:bg-neutral-100 rounded-full transition-colors relative"
                aria-label="Wishlist"
              >
                <Heart className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                {wishlistCount > 0 && (
                  <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-[#0876A8] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {wishlistCount}
                  </span>
                )}
              </Link>

              {/* Account Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="p-2 text-neutral-700 hover:text-black hover:bg-neutral-100 rounded-full transition-colors flex items-center gap-1"
                  aria-label="Account menu"
                  aria-expanded={isUserMenuOpen}
                >
                  <User className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  <ChevronDown className="w-3 h-3 text-neutral-400 hidden sm:block" />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-[#E5E5E5] shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-1 rounded-sm">
                    {isAuthenticated && user ? (
                      <div className="px-4 py-2 border-b border-neutral-100">
                        <p className="text-xs font-bold text-neutral-900 uppercase truncate">
                          {user.name}
                        </p>
                        <p className="text-[11px] text-neutral-500 truncate">{user.email}</p>
                        <span className="inline-block mt-1 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-neutral-100 text-neutral-700">
                          {user.role} Demo Account
                        </span>
                      </div>
                    ) : (
                      <div className="px-4 py-2 border-b border-neutral-100">
                        <Link
                          href="/login"
                          className="block text-xs uppercase tracking-wider font-bold text-center py-2 bg-[#111111] text-white hover:bg-black transition-colors rounded-sm"
                        >
                          Sign In / Register
                        </Link>
                      </div>
                    )}

                    {isAuthenticated && (
                      <div className="py-1">
                        <Link
                          href="/account"
                          className="flex items-center gap-2.5 px-4 py-2 text-xs text-neutral-700 hover:bg-neutral-50 hover:text-black"
                        >
                          <User className="w-3.5 h-3.5 text-neutral-500" /> Account Dashboard
                        </Link>
                        <Link
                          href="/account/orders"
                          className="flex items-center gap-2.5 px-4 py-2 text-xs text-neutral-700 hover:bg-neutral-50 hover:text-black"
                        >
                          <Package className="w-3.5 h-3.5 text-neutral-500" /> My Orders & Tracking
                        </Link>
                        <Link
                          href="/account/addresses"
                          className="flex items-center gap-2.5 px-4 py-2 text-xs text-neutral-700 hover:bg-neutral-50 hover:text-black"
                        >
                          <MapPin className="w-3.5 h-3.5 text-neutral-500" /> Saved Addresses
                        </Link>
                      </div>
                    )}

                    <div className="border-t border-neutral-100 px-4 py-2 bg-[#F5F4F0]">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-neutral-400 mb-1.5">
                        Internal Staff Portals
                      </p>
                      <div className="space-y-1">
                        <Link
                          href="/seller"
                          className="flex items-center gap-2 text-[11px] text-neutral-700 hover:text-black py-0.5 font-medium"
                        >
                          <LayoutDashboard className="w-3.5 h-3.5 text-[#0876A8]" />
                          <span>Seller Portal (Staff)</span>
                        </Link>
                        <Link
                          href="/admin"
                          className="flex items-center gap-2 text-[11px] text-neutral-700 hover:text-black py-0.5 font-medium"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-[#F5141C]" />
                          <span>Admin Control Center</span>
                        </Link>
                      </div>
                    </div>

                    {isAuthenticated && (
                      <div className="border-t border-neutral-100 pt-1">
                        <button
                          onClick={logout}
                          className="flex items-center gap-2.5 w-full text-left px-4 py-2 text-xs text-[#F5141C] hover:bg-red-50"
                        >
                          <LogOut className="w-3.5 h-3.5" /> Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Shopping Bag Trigger with Yellow Accent */}
              <button
                onClick={openDrawer}
                className="p-2 text-neutral-900 hover:text-black hover:bg-neutral-100 rounded-full transition-colors relative flex items-center"
                aria-label={`Shopping bag with ${itemCount} items`}
              >
                <ShoppingBag className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                {itemCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-[#FFB900] text-black text-[9px] font-black rounded-full flex items-center justify-center shadow-sm">
                    {itemCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div ref={mobileMenuPanelRef} role="dialog" aria-modal="true" aria-label="Main navigation" className="fixed inset-y-0 left-0 w-4/5 max-w-xs bg-white shadow-xl flex flex-col p-6 animate-in slide-in-from-left duration-250">
              <div className="flex items-center justify-between pb-5 border-b border-neutral-200">
                <BrandLogo size="sm" />
                <button
                  onClick={closeMobileMenu}
                  className="p-1 text-neutral-500 hover:text-black"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto py-5 space-y-3">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block text-sm uppercase tracking-widest font-bold text-neutral-900 hover:text-[#0876A8] py-1"
                  >
                    {link.label}
                  </Link>
                ))}

                <div className="pt-5 border-t border-neutral-100 space-y-2.5">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-neutral-400">
                    Customer Care
                  </p>
                  <Link
                    href="/size-guide"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block text-xs uppercase tracking-wider text-neutral-600 hover:text-black"
                  >
                    Size Guide
                  </Link>
                  <Link
                    href="/shipping"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block text-xs uppercase tracking-wider text-neutral-600 hover:text-black"
                  >
                    Shipping & Delivery
                  </Link>
                  <Link
                    href="/returns"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block text-xs uppercase tracking-wider text-neutral-600 hover:text-black"
                  >
                    Returns & Exchanges
                  </Link>
                  <Link
                    href="/faq"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block text-xs uppercase tracking-wider text-neutral-600 hover:text-black"
                  >
                    FAQs
                  </Link>
                </div>
              </nav>

              <div className="pt-4 border-t border-neutral-200">
                {isAuthenticated ? (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-800">{user?.name}</span>
                    <button
                      onClick={() => {
                        logout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="text-xs text-[#F5141C] font-semibold uppercase tracking-wider"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block w-full py-2.5 text-center bg-[#111111] text-white text-xs uppercase tracking-widest font-bold rounded-sm"
                  >
                    Sign In
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <CartDrawer />
    </>
  );
}
