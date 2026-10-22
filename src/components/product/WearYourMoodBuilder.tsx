"use client";

import { useState } from "react";
import { Angry, ArrowRight, Cloud, Crown, Flame, Heart, HeartCrack, LoaderCircle, Laugh, Moon, RefreshCw, Sparkles, Sun, Zap } from "lucide-react";
import { MOODS, QUOTE_STYLES, type MoodId, type QuoteStyleId } from "@/services/mood-quotes";
import { getWearYourMoodPreviewModel } from "@/services/wear-your-mood-preview";
import { useCart } from "@/context/cart-context";

const FONT_OPTIONS = [
  { id: "bold", label: "Heavy", className: "font-black uppercase tracking-tight" },
  { id: "serif", label: "Classic", className: "font-serif font-bold" },
  { id: "mono", label: "Mono", className: "font-mono font-bold" },
] as const;
const PRINT_COLORS = [
  { id: "ink", label: "Ink", value: "#171717" },
  { id: "sun", label: "Sun", value: "#e8a900" },
  { id: "ocean", label: "Ocean", value: "#0876a8" },
  { id: "berry", label: "Berry", value: "#b32c54" },
] as const;
const PLACEMENTS = [
  { id: "center", label: "Center print" },
  { id: "chest", label: "Left chest" },
] as const;
const MOOD_ICONS = {
  happy: Sun,
  confident: Crown,
  savage: Flame,
  heartbroken: HeartCrack,
  overthinking: Moon,
  energetic: Zap,
  exhausted: Cloud,
  angry: Angry,
  funny: Laugh,
  emotional: Heart,
} as const;

export function WearYourMoodBuilder() {
  const { addToBag } = useCart();
  const [mood, setMood] = useState<MoodId>("happy");
  const [style, setStyle] = useState<QuoteStyleId>("deep");
  const [story, setStory] = useState("");
  const [quotes, setQuotes] = useState<string[]>([]);
  const [quote, setQuote] = useState("");
  const [font, setFont] = useState<(typeof FONT_OPTIONS)[number]["id"]>("bold");
  const [printColor, setPrintColor] = useState<(typeof PRINT_COLORS)[number]["id"]>("ink");
  const [placement, setPlacement] = useState<(typeof PLACEMENTS)[number]["id"]>("center");
  const [size, setSize] = useState("M");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [round, setRound] = useState(0);
  const [previewImageLoaded, setPreviewImageLoaded] = useState(true);
  const [previewRatio, setPreviewRatio] = useState(0.75);

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/wear-your-mood/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mood, style, story }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not make quote suggestions.");
      const next = [...data.quotes] as string[];
      if (next.length !== 5) throw new Error("Quote suggestions are temporarily unavailable.");
      // The fallback is deterministic; rotate the five valid choices on regenerate.
      const shift = round % next.length;
      const rotated = [...next.slice(shift), ...next.slice(0, shift)];
      setRound((value) => value + 1);
      setQuotes(rotated);
      setQuote(rotated[0]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not make quote suggestions.");
    } finally {
      setBusy(false);
    }
  };

  const preview = getWearYourMoodPreviewModel({
    quote, font, printColor, size: size as "XS" | "S" | "M" | "L" | "XL" | "XXL", placement,
  });

  const addCustomTee = () => {
    if (!quote) return;
    addToBag({
      productId: "rnl-custom-quote-tee",
      productSlug: "wear-your-mood",
      productName: "Wear Your Mood Custom Quote Tee",
      color: "Natural",
      size: size as "XS" | "S" | "M" | "L" | "XL" | "XXL",
      price: 1999,
      image: "/products/custom-tee-preview.svg",
      fit: "Regular",
      customization: { type: "quote_tshirt", mood, quote, quoteStyle: style, font, printColor, placement },
    });
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14 lg:px-8">
      <header className="relative grid gap-6 border-y border-neutral-200 bg-[#f6f5f1] px-5 py-8 sm:px-8 sm:py-10 md:grid-cols-[1.3fr_.7fr] md:items-end md:gap-10 md:px-12 md:py-12">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.22em] text-neutral-500">RIGHTNOWLIFE / CUSTOM STUDIO</p>
          <h1 className="mt-4 text-6xl font-black uppercase leading-[.82] tracking-[-.065em] sm:text-7xl md:text-8xl">
            <span className="block">WEAR</span>
            <span className="mt-1 inline-block bg-[#FFB900] px-2 pb-1 text-[#111111]">YOUR MOOD</span>
          </h1>
        </div>
        <div className="max-w-xs md:mb-1">
          <span aria-hidden="true" className="mb-4 block h-px w-12 bg-[#FFB900]" />
          <p className="text-sm font-medium leading-6 text-neutral-800 md:text-base">
            Your vibe. Your statement. Your rules.
          </p>
          <a href="#mood-options" className="group mt-5 inline-flex items-center gap-3 text-[10px] font-black uppercase tracking-[.18em] text-neutral-600 transition-colors hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#FFB900]">
            <span>Explore your vibe</span>
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" strokeWidth={1.8} />
          </a>
        </div>
      </header>

      <div className="mt-9 grid gap-8 lg:grid-cols-[1.05fr_.95fr] lg:items-start">
        <div className="space-y-8">
          <section id="mood-options" className="scroll-mt-24">
            <h2 className="text-xs font-black uppercase tracking-[.16em]">01 / Pick your mood</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {MOODS.map((option) => {
                const MoodIcon = MOOD_ICONS[option.id];
                return (
                  <button key={option.id} type="button" onClick={() => setMood(option.id)} aria-pressed={mood === option.id}
                    className={`flex min-h-12 items-center gap-2 border px-3 text-left text-sm transition ${mood === option.id ? "border-[#111] bg-[#FFB900] font-bold" : "border-neutral-200 bg-white hover:border-neutral-500"}`}>
                    <MoodIcon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.8} />{option.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <label htmlFor="mood-story" className="text-xs font-black uppercase tracking-[.16em]">02 / Add a little context <span className="font-normal text-neutral-500">(optional)</span></label>
            <textarea id="mood-story" maxLength={240} value={story} onChange={(event) => setStory(event.target.value)} rows={3}
              placeholder="A moment, a thought, a tiny plot twist…" className="mt-3 w-full resize-y border border-neutral-300 p-3 text-sm outline-none focus:border-black" />
            <p className="mt-1 text-right text-[11px] text-neutral-500">{story.length}/240 · used for this request only</p>
          </section>

          <section>
            <label htmlFor="quote-style" className="text-xs font-black uppercase tracking-[.16em]">03 / Pick a quote style</label>
            <select id="quote-style" value={style} onChange={(event) => setStyle(event.target.value as QuoteStyleId)} className="mt-3 min-h-12 w-full border border-neutral-300 bg-white px-3 text-sm">
              {QUOTE_STYLES.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            <button type="button" onClick={generate} disabled={busy} className="btn-morph btn-yellow mt-3 inline-flex min-h-12 items-center gap-2 px-5 text-xs font-black uppercase tracking-wider disabled:cursor-wait disabled:opacity-60">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : quotes.length ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              {busy ? "Making suggestions" : quotes.length ? "Regenerate quotes" : "Generate 5 quotes"}
            </button>
            <p className="mt-2 text-xs text-neutral-500">Suggestions use a built-in writing fallback; no AI service is configured.</p>
            {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
            {quotes.length > 0 && <div className="mt-4 space-y-2" role="radiogroup" aria-label="Quote suggestions">
              {quotes.map((suggestion) => <button key={suggestion} type="button" role="radio" aria-checked={quote === suggestion} onClick={() => setQuote(suggestion)} className={`flex min-h-12 w-full items-center justify-between gap-3 border px-3 text-left text-sm ${quote === suggestion ? "border-black bg-neutral-100 font-bold" : "border-neutral-200 hover:border-neutral-500"}`}>
                <span>{suggestion}</span><span className="text-[10px] uppercase text-neutral-500">{quote === suggestion ? "Selected" : "Choose"}</span>
              </button>)}
            </div>}
          </section>

          {quote && <section className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-black uppercase tracking-[.16em]">Font
              <select value={font} onChange={(event) => setFont(event.target.value as typeof font)} className="mt-2 min-h-11 w-full border border-neutral-300 bg-white px-3 text-sm font-normal normal-case tracking-normal">
                {FONT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
            <label className="text-xs font-black uppercase tracking-[.16em]">Placement
              <select value={placement} onChange={(event) => setPlacement(event.target.value as typeof placement)} className="mt-2 min-h-11 w-full border border-neutral-300 bg-white px-3 text-sm font-normal normal-case tracking-normal">
                {PLACEMENTS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
            </label>
            <fieldset className="sm:col-span-2">
              <legend className="text-xs font-black uppercase tracking-[.16em]">Print color</legend>
              <div className="mt-2 flex flex-wrap gap-2">{PRINT_COLORS.map((option) => <button key={option.id} type="button" onClick={() => setPrintColor(option.id)} aria-label={option.label} aria-pressed={printColor === option.id} className={`h-9 w-9 rounded-full border-2 ${printColor === option.id ? "border-black ring-2 ring-[#FFB900] ring-offset-2" : "border-neutral-300"}`} style={{ backgroundColor: option.value }} />)}</div>
            </fieldset>
          </section>}
        </div>

        <aside className="lg:sticky lg:top-6">
          <div className="border border-neutral-200 bg-[#f6f5f1] p-5 sm:p-7">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[.18em] text-neutral-500"><span>Preview concept</span><span>Wear Your Mood</span></div>
            <div className="flex min-h-[360px] items-center justify-center overflow-hidden py-8">
              <div
                role="img"
                aria-label={preview.ariaLabel}
                className="relative mx-auto max-w-full shrink-0 transition-[width] duration-200"
                style={{
                  width: `${Math.min(350, 350 * previewRatio) * preview.garmentScale}px`,
                  maxWidth: "100%",
                  aspectRatio: `${previewRatio}`,
                  containerType: "inline-size",
                }}
              >
                {previewImageLoaded ? (
                  <img
                    src="/products/wear-your-mood-base.png"
                    alt=""
                    aria-hidden="true"
                    onLoad={(event) => {
                      const image = event.currentTarget;
                      if (image.naturalWidth && image.naturalHeight) setPreviewRatio(image.naturalWidth / image.naturalHeight);
                    }}
                    onError={() => setPreviewImageLoaded(false)}
                    className="absolute inset-0 h-full w-full object-contain drop-shadow-xl"
                  />
                ) : (
                  <svg viewBox="0 0 320 340" className="absolute inset-0 h-full w-full drop-shadow-xl" aria-hidden="true">
                    <path d="M95 29 133 14h54l38 15 72 43-36 60-42-25v214H101V107l-42 25-36-60z" fill="#fdfdfb" stroke="#deded9" strokeWidth="3" />
                    <path d="M133 14c4 27 17 42 27 42s23-15 27-42" fill="none" stroke="#deded9" strokeWidth="4" />
                  </svg>
                )}
                <span
                  aria-hidden="true"
                  className={`${preview.fontClassName} absolute z-10 flex items-center justify-center px-[1%] text-center leading-[1.05] [overflow-wrap:anywhere]`}
                  style={{
                    color: preview.color,
                    fontSize: `${preview.fontSizePx}px`,
                    left: preview.left,
                    top: preview.top,
                    width: preview.width,
                    height: preview.height,
                    textShadow: preview.color === "#171717" ? "0 0 1px rgba(0,0,0,.25)" : "0 0 1px rgba(255,255,255,.9)",
                  }}
                >
                  {preview.quoteText}
                </span>
              </div>
            </div>
            <p className="text-center text-[11px] text-neutral-500">Preview concept only · not a production-ready print file</p>
            <div className="mt-5 flex items-center justify-between border-t border-neutral-300 pt-4">
              <span className="text-xs font-bold uppercase tracking-wider">Custom quote tee</span>
              <span className="text-lg font-black">₹1,999</span>
            </div>
            <label className="mt-4 block text-xs font-bold uppercase tracking-wider">Garment size
              <select value={size} onChange={(event) => setSize(event.target.value)} className="mt-2 min-h-11 w-full border border-neutral-300 bg-white px-3 text-sm font-normal">
                {["XS", "S", "M", "L", "XL", "XXL"].map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <button type="button" onClick={addCustomTee} disabled={!quote} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 bg-[#FFB900] px-4 text-xs font-black uppercase tracking-wider text-black disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-600">
              Add custom tee to bag <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-3 border-l-2 border-[#FFB900] bg-[#fff9e8] p-3 text-xs leading-5 text-neutral-700">Made to order: custom tees are prepared after payment is verified and do not reserve catalog inventory.</p>
        </aside>
      </div>
    </main>
  );
}
