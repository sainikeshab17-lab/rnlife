const PREVIEW_COLORS = {
  ink: "#171717",
  sun: "#e8a900",
  ocean: "#0876a8",
  berry: "#b32c54",
} as const;

const PREVIEW_FONTS = {
  bold: "font-black uppercase tracking-tight",
  serif: "font-serif font-bold",
  mono: "font-mono font-bold",
} as const;

const GARMENT_SCALE = { XS: 0.9, S: 0.94, M: 0.98, L: 1, XL: 1.03, XXL: 1.06 } as const;

export function getWearYourMoodPreviewModel(selection: {
  quote: string;
  font: keyof typeof PREVIEW_FONTS;
  printColor: keyof typeof PREVIEW_COLORS;
  size: keyof typeof GARMENT_SCALE;
  placement: "center" | "chest";
}) {
  const quoteText = selection.quote || "YOUR WORDS GO HERE";
  return {
    quoteText,
    fontClassName: PREVIEW_FONTS[selection.font],
    color: PREVIEW_COLORS[selection.printColor],
    garmentScale: GARMENT_SCALE[selection.size],
    fontSizePx: Math.min(12, Math.max(6, 320 / Math.max(quoteText.length, 22))),
    left: selection.placement === "center" ? "25%" : "31%",
    top: selection.placement === "center" ? "51.5%" : "39.5%",
    width: selection.placement === "center" ? "50%" : "22%",
    height: selection.placement === "center" ? "8.4%" : "10%",
    placementLabel: selection.placement === "center" ? "center" : "left chest",
    colorLabel: selection.printColor,
    ariaLabel: `T-shirt customization preview, size ${selection.size}, ${selection.placement === "center" ? "center" : "left chest"} placement, ${selection.font} font, ${selection.printColor} print. Quote: ${quoteText}. Preview concept, not a print file.`,
  };
}
