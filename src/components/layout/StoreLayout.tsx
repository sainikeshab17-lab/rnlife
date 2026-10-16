"use client";

import React from "react";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";

export function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen bg-white text-[#111111]">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
