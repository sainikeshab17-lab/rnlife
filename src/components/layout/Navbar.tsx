"use client";

import React, { useState, useEffect } from "react";
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

export function Navbar() {
  const pathname = usePathname();
  const { itemCount, openDrawer } = useCart();
  const { itemCount: wishlistCount } = useWishlist();
  const { user, isAuthenticated, logout, setRole } = useAuth();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
  }, [pathname]);

  const navLinks = [
    { label: "Shop All", href: "/shop" },
    { label: "New Drops", href: "/collections/new-drops" },
    { label: "Graphic Tees", href: "/collections/graphic-tees" },
    { label: "Oversized Tees", href: "/collections/oversized-tees" },
    { label: "Essentials", href: "/collections/essentials" },
    { label: "About", href: "/about" },
  ];

  return (
    <>
      <AnnouncementBar />

      <header
        className={`sticky top-0 z-40 w-full transition-all duration-200 ${
          isScrolled
            ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-neutral-200"
            : "bg-white border-b border-neutral-200"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-20">
            {/* Mobile Menu Button */}
            <div className="flex items-center lg:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 -ml-2 text-neutral-800 hover:text-black transition-colors"
                aria-label="Open mobile menu"
              >
                <Menu className="w-6 h-6" />
              </button>
            </div>

            {/* Brand Wordmark Logo */}
            <div className="flex-1 lg:flex-none text-center lg:text-left">
              <Link
                href="/"
                className="inline-block tracking-tighter text-xl sm:text-2xl md:text-2xl font-black uppercase text-[#111111] hover:opacity-80 transition-opacity font-mono tracking-widest-custom"
                style={{ letterSpacing: "0.15em" }}
              >
                RIGHTNOWLIFE
              </Link>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center space-x-7">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`text-xs uppercase tracking-widest font-semibold transition-colors duration-150 py-1 border-b-2 ${
                      isActive
                        ? "border-black text-black"
                        : "border-transparent text-neutral-600 hover:text-black hover:border-neutral-300"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Header Right Action Icons */}
            <div className="flex items-center space-x-3 sm:space-x-4">
              {/* Search Trigger */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="p-2 text-neutral-700 hover:text-black transition-colors"
                aria-label="Search catalog"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Wishlist Icon */}
              <Link
                href="/account/wishlist"
                className="p-2 text-neutral-700 hover:text-black transition-colors relative"
                aria-label="Wishlist"
              >
                <Heart className="w-5 h-5" />
                {wishlistCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-[#111111] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {wishlistCount}
                  </span>
                )}
              </Link>

              {/* User Account / Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="p-2 text-neutral-700 hover:text-black transition-colors flex items-center gap-1"
                  aria-label="Account menu"
                  aria-expanded={isUserMenuOpen}
                >
                  <User className="w-5 h-5" />
                  <ChevronDown className="w-3 h-3 text-neutral-400 hidden sm:block" />
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-neutral-200 shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2">
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
                          className="block text-xs uppercase tracking-wider font-bold text-center py-2 bg-black text-white hover:bg-neutral-800 transition-colors"
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
                          <User className="w-3.5 h-3.5" /> Account Dashboard
                        </Link>
                        <Link
                          href="/account/orders"
                          className="flex items-center gap-2.5 px-4 py-2 text-xs text-neutral-700 hover:bg-neutral-50 hover:text-black"
                        >
                          <Package className="w-3.5 h-3.5" /> My Orders & Tracking
                        </Link>
                        <Link
                          href="/account/addresses"
                          className="flex items-center gap-2.5 px-4 py-2 text-xs text-neutral-700 hover:bg-neutral-50 hover:text-black"
                        >
                          <MapPin className="w-3.5 h-3.5" /> Saved Addresses
                        </Link>
                      </div>
                    )}

                    {/* Prototype Perspective Switcher */}
                    <div className="border-t border-neutral-100 px-4 py-2 bg-neutral-50">
                      <p className="text-[10px] uppercase tracking-wider font-bold text-neutral-400 mb-1.5">
                        Internal Staff Portals
                      </p>
                      <div className="space-y-1">
                        <Link
                          href="/seller"
                          className="flex items-center gap-2 text-[11px] text-neutral-700 hover:text-black py-1 font-medium"
                        >
                          <LayoutDashboard className="w-3.5 h-3.5 text-neutral-500" />
                          <span>Seller Portal (Staff)</span>
                        </Link>
                        <Link
                          href="/admin"
                          className="flex items-center gap-2 text-[11px] text-neutral-700 hover:text-black py-1 font-medium"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-neutral-500" />
                          <span>Admin Control Center</span>
                        </Link>
                      </div>
                    </div>

                    {isAuthenticated && (
                      <div className="border-t border-neutral-100 pt-1">
                        <button
                          onClick={logout}
                          className="flex items-center gap-2.5 w-full text-left px-4 py-2 text-xs text-red-600 hover:bg-red-50"
                        >
                          <LogOut className="w-3.5 h-3.5" /> Sign Out
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Shopping Bag Icon with Drawer Trigger */}
              <button
                onClick={openDrawer}
                className="p-2 text-neutral-900 hover:text-black transition-colors relative flex items-center"
                aria-label={`Shopping bag with ${itemCount} items`}
              >
                <ShoppingBag className="w-5 h-5" />
                {itemCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-[#B8FF3B] text-black text-[9px] font-black rounded-full flex items-center justify-center shadow-sm">
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
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 w-4/5 max-w-sm bg-white shadow-2xl flex flex-col p-6 animate-in slide-in-from-left duration-300">
              <div className="flex items-center justify-between pb-6 border-b border-neutral-200">
                <span className="text-base font-black tracking-widest font-mono text-[#111111]">
                  RIGHTNOWLIFE
                </span>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 text-neutral-500 hover:text-black"
                  aria-label="Close menu"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto py-6 space-y-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block text-sm uppercase tracking-widest font-bold text-neutral-800 hover:text-black py-1.5"
                  >
                    {link.label}
                  </Link>
                ))}

                <div className="pt-6 border-t border-neutral-100 space-y-3">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-neutral-400">
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

                <div className="pt-6 border-t border-neutral-100 space-y-2">
                  <p className="text-[11px] uppercase tracking-wider font-semibold text-neutral-400">
                    Internal Dashboards
                  </p>
                  <Link
                    href="/seller"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-700 hover:text-black"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" /> Seller Portal
                  </Link>
                  <Link
                    href="/admin"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-xs uppercase tracking-wider text-neutral-700 hover:text-black"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" /> Admin Dashboard
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
                      className="text-xs text-red-600 font-semibold uppercase tracking-wider"
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block w-full py-2.5 text-center bg-black text-white text-xs uppercase tracking-widest font-bold"
                  >
                    Sign In
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Global Modals & Drawers */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <CartDrawer />
    </>
  );
}
