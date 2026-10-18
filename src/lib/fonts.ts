import { Anton, Bebas_Neue, DM_Sans, Inter, Outfit, Space_Grotesk } from "next/font/google";

export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas-neue",
  display: "swap",
});

export const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-preview-anton",
  display: "swap",
});

export const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-preview-outfit",
  display: "swap",
});

export const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-preview-dm-sans",
  display: "swap",
});
