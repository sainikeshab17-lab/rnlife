import { StoreLayout } from "@/components/layout/StoreLayout";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { BRAND_INFO } from "@/data/mock-data";

const sectionClass = "space-y-3";
const headingClass =
  "text-sm font-bold uppercase tracking-wider text-black";

export default function PrivacyPolicyPage() {
  return (
    <StoreLayout>
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <Breadcrumbs items={[{ label: "Privacy Policy" }]} />

        <header className="border-b border-neutral-200 py-8">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-widest font-mono text-neutral-500">
            CUSTOMER INFORMATION
          </span>
          <h1 className="text-3xl font-black uppercase tracking-tight font-editorial sm:text-5xl">
            PRIVACY POLICY
          </h1>
          <p className="mt-2 text-xs text-neutral-600 sm:text-sm">
            Last updated: 16 October 2026
          </p>
          <p className="mt-4 text-xs leading-relaxed text-neutral-700 sm:text-sm">
            This Privacy Policy describes how RightNowLife collects, uses, and
            discloses information when you use the website, and explains your
            privacy rights. Personal data is used to provide and improve the
            service.
          </p>
        </header>

        <div className="space-y-8 py-8 text-xs leading-relaxed text-neutral-700 sm:text-sm">
          <section className={sectionClass}>
            <h2 className={headingClass}>Information We Collect</h2>
            <p>
              Information you may provide includes your email address, first
              and last name, phone number, address, state or province,
              postal code, city, and usage data.
            </p>
            <p>
              Usage data may be collected automatically and can include your
              device&apos;s IP address, browser type and version, pages visited,
              visit time and date, time spent on pages, device identifiers,
              and diagnostic data. Additional device and mobile browser
              information may be collected when you access the service through
              a mobile device.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Cookies and Tracking Technologies</h2>
            <p>
              The service uses cookies and similar technologies, including
              beacons, tags, and scripts, to track activity and improve and
              analyse the service. The published policy describes session and
              persistent cookies, including cookies used for essential
              functionality, cookie notice acceptance, and functionality such
              as remembering login details or language preferences.
            </p>
            <p>
              You can instruct your browser to refuse cookies or indicate when
              a cookie is being sent. Some parts of the service may not work
              if cookies are refused.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>How Personal Data Is Used</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>To provide, maintain, and monitor the service.</li>
              <li>To manage user accounts and registration.</li>
              <li>
                To perform purchase contracts and other agreements with you.
              </li>
              <li>
                To contact you about service functionality, products,
                contracted services, and security updates.
              </li>
              <li>
                To provide news, special offers, and information about similar
                goods, services, and events unless you have opted out.
              </li>
              <li>To attend to and manage your requests.</li>
              <li>
                For business transfers and other purposes such as data
                analysis, usage trends, promotional effectiveness, and service
                improvement.
              </li>
            </ul>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>When Personal Data May Be Shared</h2>
            <p>
              The published policy says information may be shared with service
              providers that monitor or analyse the service or contact users;
              in connection with business transfers; with affiliates and
              business partners; in public areas or through third-party social
              media services; and for other purposes with your consent.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Retention and Transfers</h2>
            <p>
              Personal data is retained for as long as necessary for the
              purposes described in the policy, including to meet legal
              obligations, resolve disputes, and enforce agreements and
              policies. Usage data is generally retained for a shorter period,
              except when used for security or service improvements or when
              longer retention is legally required.
            </p>
            <p>
              Information may be processed at the Company&apos;s operating
              offices or other locations where processing parties are located
              and may be transferred to jurisdictions with different data
              protection laws. The policy states that reasonable steps will be
              taken to protect transferred information and that transfers will
              only take place where adequate controls are in place.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Disclosure and Security</h2>
            <p>
              The policy describes disclosure in business transactions, when
              required by law or valid public-authority requests, and when
              considered necessary to comply with legal obligations, protect
              rights or property, investigate possible wrongdoing, protect
              personal safety, or guard against legal liability.
            </p>
            <p>
              RightNowLife states that it seeks to use commercially acceptable
              means to protect personal data, but that transmission over the
              Internet and electronic storage cannot be guaranteed to be
              completely secure.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Children&apos;s Privacy</h2>
            <p>
              The service is not directed to children under 13, and the
              published policy says personal data is not knowingly collected
              from children under 13. If a parent or guardian believes a child
              has provided personal data, they are asked to contact
              RightNowLife. The policy also describes steps to remove such
              data if it is identified without verified parental consent.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Links to Other Websites</h2>
            <p>
              The service may link to websites not operated by RightNowLife.
              The published policy advises reviewing the privacy policy of
              each third-party website and states that RightNowLife does not
              control or assume responsibility for those websites or their
              practices.
            </p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Changes to This Policy</h2>
            <p>
              Updates will be posted on this page with a revised “Last
              updated” date. The published policy says notice may be provided
              by email and/or a prominent notice before changes take effect,
              and that changes are effective when posted.
            </p>
          </section>

          <section className="border-t border-neutral-200 pt-6">
            <h2 className={headingClass}>Contact Us</h2>
            <p className="mt-2">
              For questions about this Privacy Policy, contact{" "}
              <a
                href={`mailto:${BRAND_INFO.supportEmail}`}
                className="font-bold text-black underline"
              >
                {BRAND_INFO.supportEmail}
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </StoreLayout>
  );
}
