import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";

const sectionClass = "space-y-3";
const headingClass =
  "text-sm font-bold uppercase tracking-wider text-black";

export default function TermsPage() {
  return (
    <StoreLayout>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: "Terms & Conditions" }]} />

        <header className="border-b border-neutral-200 py-8">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest font-mono text-neutral-500">
            WEBSITE TERMS
          </span>
          <h1 className="text-3xl font-black uppercase tracking-tight font-editorial sm:text-5xl">
            TERMS &amp; CONDITIONS
          </h1>
          <p className="mt-2 text-xs text-neutral-600 sm:text-sm">
            Last updated: 16 October 2026
          </p>
          <p className="mt-4 text-xs leading-relaxed text-neutral-700 sm:text-sm">
            These Terms and Conditions govern access to and use of
            rightnowlife.com and the products and services offered through it.
            By accessing or purchasing from the website, you agree to these
            terms. If you do not agree, discontinue using the website.
          </p>
        </header>

        <div className="space-y-8 py-8 text-xs leading-relaxed text-neutral-700 sm:text-sm">
          <section className={sectionClass}>
            <h2 className={headingClass}>1. Definitions and Applicable Law</h2>
            <p>
              “Company,” “We,” “Us,” and “Our” refer to RightNowLife; “Website”
              refers to rightnowlife.com; “You,” “Your,” and “Customer” refer
              to a person using the website or purchasing products; “Products”
              or “Goods” refers to products offered on the website, including
              raglan T-shirts and graphic apparel; and “Order” refers to a
              purchase request submitted through the website. The published
              terms state that they are governed by applicable laws of India.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>2. Eligibility and Website Use</h2>
            <p>
              By using the website, you confirm that you are legally capable
              of entering into a binding agreement under applicable law. You
              agree to use it lawfully and not to damage, disrupt, or
              interfere with the website, its services, or other users.
              RightNowLife may restrict or suspend access if it reasonably
              believes the website is being misused or these terms are being
              violated.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>3. Products and Product Information</h2>
            <p>
              RightNowLife makes reasonable efforts to display product
              descriptions, colours, designs, images, sizes, and prices
              accurately. Actual colours and appearance may vary with screens,
              device settings, lighting, and photography. Availability,
              designs, and prices may change without prior notice, subject to
              applicable law and orders already confirmed.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>4. Pricing and Payments</h2>
            <p>
              Prices are displayed in Indian Rupees unless stated otherwise.
              Applicable taxes, shipping charges, discounts, and other fees
              will be displayed during checkout or communicated before an
              order is completed. Payment must use a method made available on
              the website. RightNowLife reserves the right to correct genuine
              pricing or listing errors and says it will contact customers
              to resolve material errors affecting an order already placed.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>5. Orders and Acceptance</h2>
            <p>
              Customers agree to provide accurate and complete order
              information. An order confirmation does not necessarily
              guarantee acceptance if an order cannot be fulfilled because of
              stock unavailability, a technical error, a payment issue, or
              another legitimate reason. If a paid order cannot be fulfilled,
              RightNowLife says it will notify the customer and arrange an
              applicable refund under its policies and applicable law. Orders
              involving suspected fraud, payment irregularities, or material
              listing errors may be cancelled, subject to applicable law.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>6. Shipping and Delivery</h2>
            <p>
              Orders are shipped to customer-provided addresses subject to
              destination serviceability. Estimated delivery timelines are
              indicative and may vary due to courier delays, weather,
              operational disruptions, or circumstances beyond reasonable
              control. Customers are responsible for providing accurate
              delivery information. Shipping questions are addressed by the{" "}
              <a className="font-bold text-black underline" href="/shipping">
                Shipping Policy
              </a>
              .
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>
              7. Returns, Refunds, Exchanges, and Cancellations
            </h2>
            <p>
              These requests are governed by the{" "}
              <a className="font-bold text-black underline" href="/returns">
                Return and Refund Policy
              </a>
              . Nothing in the published terms limits consumer rights or
              remedies available under applicable Indian law.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>8. Intellectual Property</h2>
            <p>
              Unless otherwise stated, website content—including text, logos,
              graphics, photographs, product artwork, designs, and website
              elements—belongs to RightNowLife or its respective licensors and
              is protected by applicable intellectual property laws. Website
              use is for personal, non-commercial purposes. Prior written
              permission is required for commercial copying or republication,
              redistribution or sale of artwork, photographs, or branding,
              derivative works, or use suggesting an unauthorised association
              or endorsement. All rights not expressly granted are reserved.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>9. Customer Communications and Reviews</h2>
            <p>
              If the website permits reviews, comments, or other submissions,
              users are responsible for ensuring they are lawful, truthful to
              the best of their knowledge, and do not infringe others&apos;
              rights. Fraudulent, defamatory, abusive, discriminatory,
              unlawful, or misleading content must not be submitted. Where
              permitted by law, RightNowLife may display and use submitted
              reviews or feedback for operating and promoting its business;
              ownership of the content does not transfer. Violating content
              may be removed or restricted.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>
              10. Website Availability and Third-Party Services
            </h2>
            <p>
              RightNowLife aims to keep the website accessible but cannot
              guarantee uninterrupted availability. The website may depend on
              third-party services, including payment gateways, hosting
              providers, and delivery partners, which may be unavailable or
              delayed. The published terms address disruptions outside
              reasonable control subject to applicable law. Third-party links
              are provided for convenience and are not necessarily endorsed
              or controlled by RightNowLife.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>11. Limitation of Liability</h2>
            <p>
              To the extent permitted by applicable law, the published terms
              exclude liability for indirect or consequential losses arising
              from website use or delays caused by circumstances beyond
              reasonable control. They do not exclude or restrict liability
              that cannot lawfully be excluded or restricted, including
              applicable consumer rights and remedies.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>12. Privacy and Cookies</h2>
            <p>
              Website use is also subject to the{" "}
              <a className="font-bold text-black underline" href="/privacy">
                Privacy Policy
              </a>
              . The website may use cookies and similar technologies for
              essential functionality, user experience, website performance
              analysis, and other disclosed purposes. Where required, consent
              will be obtained for the relevant cookies or data processing.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>13. Changes to These Terms</h2>
            <p>
              RightNowLife may update these terms to reflect changes in its
              business, website, services, or applicable law. The updated
              version will be published on this page with a revised “Last
              updated” date, and changes apply as permitted by applicable law.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>14. Governing Law and Disputes</h2>
            <p>
              These terms are governed by the laws of India. Disputes are
              handled by competent courts or authorities with jurisdiction
              under applicable Indian law. Nothing in this section limits a
              consumer&apos;s right to approach a consumer commission or other
              forum available under applicable law.
            </p>
          </section>

          <section className="border-t border-neutral-200 pt-6">
            <h2 className={headingClass}>15. Contact Us</h2>
            <p className="mt-2">
              For questions about these terms, an order, or products, contact
              RightNowLife at{" "}
              <a
                href="mailto:contact@rightnowlife.com"
                className="font-bold text-black underline"
              >
                contact@rightnowlife.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </StoreLayout>
  );
}
