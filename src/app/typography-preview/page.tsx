import Image from "next/image";
import { Manrope, Oswald, Syne } from "next/font/google";
import { BrandLogo } from "@/components/common/BrandLogo";
import styles from "./typography-preview.module.css";

const oswald = Oswald({
  subsets: ["latin"],
  variable: "--font-preview-oswald",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-preview-manrope",
  display: "swap",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-preview-syne",
  display: "swap",
});

const options = [
  {
    id: "A",
    name: "Modern Streetwear",
    fonts: "Bebas Neue · Space Grotesk · Inter",
    className: styles.optionA,
  },
  {
    id: "B",
    name: "Bold and Funky",
    fonts: "Anton · Outfit · DM Sans",
    className: styles.optionB,
  },
  {
    id: "C",
    name: "Minimal and Premium",
    fonts: "Oswald · Manrope · Inter",
    className: styles.optionC,
  },
  {
    id: "D",
    name: "Contemporary and Creative",
    fonts: "Syne · Space Grotesk · DM Sans",
    className: styles.optionD,
  },
];

export default function TypographyPreviewPage() {
  return (
    <main className={`${styles.page} ${oswald.variable} ${manrope.variable} ${syne.variable}`}>
      <header className={styles.pageHeader}>
        <p className={styles.eyebrow}>RIGHTNOWLIFE / BRAND STUDIO</p>
        <h1 className={styles.pageTitle}>TYPE STUDY</h1>
        <p className={styles.intro}>
          One brand. Four type directions. Compare the same streetwear story in
          every combination.
        </p>
      </header>

      <div className={styles.options}>
        {options.map((option) => (
          <section
            key={option.id}
            className={`${styles.panel} ${option.className}`}
            aria-labelledby={`option-${option.id}-title`}
          >
            <header className={styles.panelHeader}>
              <div>
                <p className={styles.optionLabel}>OPTION {option.id}</p>
                <h2
                  id={`option-${option.id}-title`}
                  className={styles.optionName}
                >
                  {option.name}
                </h2>
              </div>
              <p className={styles.fontNames}>{option.fonts}</p>
            </header>

            <div className={styles.sample}>
              <div className={styles.brand}>
                <BrandLogo
                  size="lg"
                  className={styles.logo}
                />
              </div>

              <div className={styles.hero}>
                <div className={styles.heroCopy}>
                  <p className={styles.kicker}>MADE FOR THE MOOD YOU&apos;RE IN</p>
                  <h3 className={styles.headline}>WEAR YOUR MOOD.</h3>
                  <p className={styles.subheading}>
                    Your vibe. Your rules. Your life.
                  </p>
                  <p className={styles.bodyCopy}>
                    A little unpredictable, completely yourself. Find the tee
                    that feels like you and make every day your own.
                  </p>
                  <button type="button" className={styles.shopButton}>
                    SHOP NOW
                  </button>
                </div>

                <article className={styles.productCard}>
                  <div className={styles.productImage}>
                    <Image
                      src="/products/tshirt_product_images_high_quality/design_01_01_front_view.jpg"
                      alt="RIGHTNOWLIFE Design 01 graphic T-shirt"
                      fill
                      sizes="(max-width: 700px) 35vw, 180px"
                      className={styles.productPhoto}
                    />
                    <span className={styles.productTag}>EVERYDAY ICON</span>
                  </div>
                  <div className={styles.productDetails}>
                    <h4 className={styles.productName}>SOCIAL BATTERY: LOW</h4>
                    <p className={styles.price}>₹999</p>
                  </div>
                </article>
              </div>

              <div className={styles.categories} aria-label="Categories">
                <span>HOT GIRL STUFF</span>
                <span>EVERYDAY CHAOS</span>
                <span>FRIDAY MODE</span>
              </div>
            </div>
          </section>
        ))}
      </div>

      <footer className={styles.footer}>
        Preview only · No storefront styles or settings have been changed
      </footer>
    </main>
  );
}
