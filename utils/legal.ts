export const CONTACT_EMAIL = "2939561428@qq.com";
export const COPYRIGHT_YEAR = 2026;

export const LEGAL_HEADER_TITLES = {
  cookies: "cookie-policy",
  terms: "terms-of-use",
} as const;

export const LEGAL_PAGE_SEO = {
  about: {
    canonicalPath: "/about/",
    title: "About a.toolsbox.vip",
    seoDescription:
      "Learn how a.toolsbox.vip reviews online tools, maintains resource listings, and handles corrections.",
    keywords: ["about a.toolsbox.vip", "editorial process", "tool directory"],
  },
  contact: {
    canonicalPath: "/contact/",
    title: "Contact a.toolsbox.vip",
    seoDescription:
      "Contact a.toolsbox.vip about corrections, broken links, privacy requests, rights concerns, or advertising.",
    keywords: ["contact a.toolsbox.vip", "report broken link", "privacy contact"],
  },
  cookies: {
    canonicalPath: "/cookies/",
    title: "Cookie and Advertising Policy - a.toolsbox.vip",
    seoDescription:
      "Review cookie, local-storage, advertising, analytics, and consent choices on a.toolsbox.vip.",
    keywords: ["cookie policy", "advertising cookies", "cookie settings"],
  },
  privacy: {
    canonicalPath: "/privacy/",
    title: "Privacy Policy - a.toolsbox.vip",
    seoDescription:
      "Read how a.toolsbox.vip handles browser preferences, operational logs, external links, advertising, and analytics.",
    keywords: ["privacy policy", "advertising privacy", "analytics privacy"],
  },
  terms: {
    canonicalPath: "/terms/",
    title: "Terms of Use - a.toolsbox.vip",
    seoDescription:
      "Read the terms governing use of a.toolsbox.vip, its editorial content, utilities, and external links.",
    keywords: ["terms of use", "website terms", "external link disclaimer"],
  },
};

const LAST_UPDATED = "July 19, 2026";

export const createLegalContent = (siteName: string) => ({
  about: `
    <h1>About ${siteName}</h1>
    <p><strong>Last updated:</strong> ${LAST_UPDATED}</p>
    <p>${siteName} is an independent resource hub for discovering online tools, practical utilities, guides, and curated web resources. Our goal is to help visitors understand what a resource does and decide whether it is relevant before following an external link.</p>

    <h2>What We Publish</h2>
    <p>The site includes built-in utilities, original explanatory pages, category collections, and links to third-party services. We organize resources by topic and may add summaries, usage notes, comparisons, or update information where it is useful to visitors.</p>

    <h2>How Resources Are Reviewed</h2>
    <p>We consider relevance, apparent functionality, clarity, accessibility, and usefulness. Listings are reviewed periodically, but third-party services can change without notice. Inclusion does not constitute an endorsement, partnership, or guarantee.</p>

    <h2>Independence and Corrections</h2>
    <p>Unless a page expressly says otherwise, ${siteName} is not owned by or affiliated with the third-party products and websites it references. Product names and trademarks belong to their respective owners.</p>
    <p>If you find an outdated link, factual error, unsafe destination, or ownership concern, contact us at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>. We review substantiated correction and removal requests.</p>
  `,
  contact: `
    <h1>Contact ${siteName}</h1>
    <p><strong>Last updated:</strong> ${LAST_UPDATED}</p>
    <p>For questions about this website, contact us by email at <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

    <h2>What You Can Contact Us About</h2>
    <ul>
      <li>Broken, outdated, or unsafe links.</li>
      <li>Corrections to tool descriptions or editorial content.</li>
      <li>Copyright, trademark, or other rights concerns.</li>
      <li>Privacy and data-rights requests.</li>
      <li>Advertising or business inquiries.</li>
    </ul>

    <h2>Information to Include</h2>
    <p>Please include the relevant page URL, a clear description of the issue, and any supporting information. Do not send passwords, payment details, identity documents, or other sensitive information.</p>
  `,
  privacy: `
    <h1>Privacy Policy for ${siteName}</h1>
    <p><strong>Last updated:</strong> ${LAST_UPDATED}</p>
    <p>This policy explains the information that may be processed when you visit ${siteName}, how optional advertising and analytics services are controlled, and the choices available to you.</p>

    <h2>Information Processed</h2>
    <p>You can browse the site without creating an account. We do not ask visitors for account passwords or payment-card information. Hosting and security providers may process standard request information such as IP address, browser type, requested URL, timestamps, and diagnostic data to deliver and protect the site.</p>

    <h2>Local Storage and Preferences</h2>
    <p>The site stores your theme preference and your cookie-consent choice in your browser. These values support requested site functionality and do not identify you by name.</p>

    <h2>Advertising and Analytics</h2>
    <p>If you choose Accept in the cookie notice, optional services including Monetag, Google AdSense, and Microsoft Clarity may load. These providers may use cookies or similar technologies to deliver advertising, measure performance, prevent fraud, and understand site usage. If you choose Reject, the site does not intentionally load those optional scripts.</p>

    <h2>Third-Party Links</h2>
    <p>Pages may link to websites operated by other organizations. Their privacy practices and content are governed by their own policies. Review those policies before providing information to an external service.</p>

    <h2>Retention and Disclosure</h2>
    <p>Browser preferences remain until you change or clear them. Operational records are retained only as needed for security, reliability, legal obligations, and service administration. Information may be disclosed when required by law or when reasonably necessary to protect the site and its users.</p>

    <h2>Your Choices</h2>
    <p>You can reject optional cookies, reopen Cookie Settings from the footer, clear stored site data in your browser, or use browser controls to restrict cookies. Requests concerning this policy can be sent to <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>

    <h2>Policy Updates</h2>
    <p>We may update this policy when site features, providers, or legal requirements change. The current revision date appears at the top of this page.</p>
  `,
  cookies: `
    <h1>Cookie and Advertising Policy</h1>
    <p><strong>Last updated:</strong> ${LAST_UPDATED}</p>
    <p>This page explains how ${siteName} uses browser storage, cookies, advertising technology, and analytics services.</p>

    <h2>Necessary Storage</h2>
    <p>The site uses local storage to remember your visual theme and your cookie-consent choice. These preferences are necessary to provide the settings you request and are available even when optional cookies are rejected.</p>

    <h2>Optional Advertising and Analytics</h2>
    <p>After you choose Accept, the site may load Monetag advertising technology, Google AdSense, and Microsoft Clarity. Those providers may set or read cookies and similar identifiers for ad delivery, measurement, fraud prevention, frequency control, and usage analytics. Their retention periods and processing practices are described in their own policies.</p>
    <p>For details about Monetag's publisher requirements, review the <a href="https://monetag.com/terms/#pterms">Monetag Publisher Terms</a>.</p>

    <h2>Accepting, Rejecting, or Withdrawing Consent</h2>
    <p>You may accept or reject optional technologies from the consent notice. You can reopen Cookie Settings from the site footer at any time. A changed choice applies to future loading; you can remove cookies already stored by using your browser's site-data controls.</p>

    <h2>Contact</h2>
    <p>Questions about cookies or advertising disclosures can be sent to <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
  `,
  terms: `
    <h1>Terms of Use</h1>
    <p><strong>Last updated:</strong> ${LAST_UPDATED}</p>
    <p>These terms govern your use of ${siteName}. By using the site, you agree to use it lawfully and responsibly.</p>

    <h2>Permitted Use</h2>
    <p>You may browse publicly available pages and use the site's utilities for personal or lawful business purposes. You must not interfere with site operation, bypass security controls, introduce malicious code, scrape the service in a disruptive manner, or use the site to violate applicable law or third-party rights.</p>

    <h2>Editorial Content and External Resources</h2>
    <p>Descriptions and guides are provided for general informational purposes. External links lead to services that we do not control. Availability, pricing, safety, terms, and functionality can change, so you should verify important information with the relevant provider.</p>

    <h2>Intellectual Property</h2>
    <p>Original site text, layout, and site-owned assets may not be copied or redistributed in a misleading or unlawful manner. Third-party names, logos, trademarks, and content remain the property of their respective owners. Contact us if you believe material on the site infringes your rights.</p>

    <h2>Advertising</h2>
    <p>The site may contain advertising or sponsored destinations. Advertising does not constitute an endorsement, and interactions with advertisers are governed by the advertiser's own terms and policies.</p>

    <h2>No Warranty and Limitation</h2>
    <p>The site is provided on an "as available" basis. We do not guarantee uninterrupted access, error-free content, or the continued availability of third-party resources. To the extent permitted by applicable law, we are not responsible for losses resulting from reliance on external services or content outside our control.</p>

    <h2>Changes and Contact</h2>
    <p>We may update these terms when the site or applicable requirements change. Continued use after an update means the revised terms apply. Questions can be sent to <a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a>.</p>
  `,
});
