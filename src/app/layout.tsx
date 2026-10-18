import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/context/providers";
import { anton, bebasNeue, dmSans, inter, outfit, spaceGrotesk } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "RIGHTNOWLIFE | Independent Streetwear & Premium T-Shirts",
  description:
    "RightNowLife is an independent Indian streetwear label crafting heavyweight graphic, oversized, and essential T-shirts designed for everyday self-expression.",
  keywords: [
    "RightNowLife",
    "streetwear India",
    "oversized t-shirts",
    "graphic tees",
    "heavyweight cotton tees",
    "Indian fashion label",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${anton.variable} ${bebasNeue.variable} ${dmSans.variable} ${inter.variable} ${outfit.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-[#111111]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
