# Cookie Policy

**Effective Date:** 1 August 2026
**Last Updated:** 1 August 2026
**Platform:** ServeIQ (hospitalityOS-doc)
**Operator:** ServeIQ Technologies Ltd

---

## 1. Introduction

This Cookie Policy explains how **ServeIQ Technologies Ltd** ("we," "us," or "our") uses cookies and similar technologies when you access or use the ServeIQ platform, including the admin web application, waiter mobile application, and the customer-facing ordering and tracking pages.

This policy should be read together with our [Privacy Policy](PRIVACY.md) and [Terms of Service](TERMS_OF_SERVICE.md).

---

## 2. What Are Cookies?

A **cookie** is a small text file stored on your device (computer, tablet, smartphone) when you visit a website or use a web application. Cookies enable the platform to "remember" your actions and preferences over time, maintain your session, and improve your experience.

Cookies can be classified as:
- **First-party cookies:** Set by the platform domain itself (e.g., serveiq.io).
- **Third-party cookies:** Set by domains other than the one you are visiting (e.g., analytics providers).

---

## 3. Cookies We Use

### 3.1 Essential Cookies

These cookies are strictly necessary for the operation of the platform. They cannot be disabled and do not require consent.

| Cookie Name | Type | Purpose | Duration |
|---|---|---|---|
| `access_token` | First-party (HttpOnly, Secure, SameSite=Strict) | JWT access token used to authenticate staff and owner sessions. It is HttpOnly (inaccessible to JavaScript) to protect against cross-site scripting (XSS) attacks. | 15 minutes |
| `refresh_token` | First-party (HttpOnly, Secure, SameSite=Strict) | JWT refresh token used to obtain a new access token when the current one expires, maintaining your session. Stored server-side as a SHA-256 hash. | 7 days |

**Why these are essential:** The `access_token` and `refresh_token` cookies are required for you to log in and use authenticated features such as the admin dashboard, waiter application, and staff management. Without these cookies, the platform cannot function as intended.

### 3.2 Preference Cookies

These cookies remember your preferences and choices to improve your experience.

| Cookie Name | Type | Purpose | Duration |
|---|---|---|---|
| *Preference settings (e.g., language, currency, theme)* | First-party | Remembers platform preferences so you do not need to re-select them each visit. | Up to 12 months |

### 3.3 Analytics Cookies

These cookies help us understand how users interact with the platform to improve functionality and performance.

| Cookie | Type | Purpose | Duration |
|---|---|---|---|
| `_ga` (if analytics enabled) | Third-party | Google Analytics cookie that distinguishes unique users and tracks usage statistics. | 24 months |
| `_gid` (if analytics enabled) | Third-party | Google Analytics cookie used to track usage sessions. | 24 hours |

> **Note:** Analytics cookies are only set if we enable integrated analytics. They are **non-essential** and require your consent where applicable.

### 3.4 Cookies We Do NOT Use

We do **not** use the following:
- Third-party advertising or tracking cookies
- Cross-site social media tracking pixels
- Cookies designed to profile users for targeted marketing
- Behavioral advertising cookies

---

## 4. How to Control Cookies

### 4.1 Browser Settings

Most browsers allow you to control cookies through their settings. You can:
- **Delete all cookies** stored on your device.
- **Block all cookies** from being set.
- **Block third-party cookies** only.
- **Receive a notification** before each cookie is set.

The procedures vary by browser. The following links provide guidance:
- **Chrome:** https://support.google.com/chrome/answer/95647
- **Firefox:** https://support.mozilla.org/kb/delete-cookies-remove-info-websites-stored
- **Safari:** https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac
- **Edge:** https://support.microsoft.com/microsoft-edge/manage-sites-and-data

### 4.2 Impact of Disabling Cookies

If you disable **essential cookies**, you may be unable to log in, maintain a session, or use authenticated features of the platform. The customer-facing public menu and order-tracking pages do not require essential cookies and will continue to function.

If you disable **analytics cookies**, the platform will continue to function normally; you will simply not be included in anonymous usage statistics.

---

## 5. Consent

**Essential cookies** are strictly necessary and are set without consent, in line with applicable data protection laws (e.g., Article 5 of the GDPR / the ePrivacy Directive).

**Non-essential cookies** (analytics, preferences) are set only after we obtain your consent, which you can provide through:
- A cookie consent banner or pop-up on the platform (where implemented)
- Your browser settings

You may withdraw your consent at any time by managing your cookie settings, as described in Section 4 above.

---

## 6. Third-Party Cookies and Similar Technologies

The platform relies on third-party services that may set cookies or similar technologies when their features are used:

| Provider | Technology | Purpose |
|---|---|---|
| **Google Analytics (if enabled)** | Analytics cookies | Usage statistics |
| **Paystack (V2+)** | Checkout cookies | Payment processing |
| **Sentry** | Storage | Error monitoring and performance |
| **Cloudinary** | CDN storage | File delivery |

These providers have their own privacy and cookie policies. We encourage you to review them. The relevant provider links are listed in the [Privacy Policy](PRIVACY.md#12--third-party-services-and-links).

---

## 7. Local Storage and Other Technologies

In addition to cookies, the platform uses certain browser storage technologies:

- **Web Storage (localStorage/sessionStorage):** Used by the frontend applications to store temporary UI state and cached data for offline functionality (e.g., the waiter app's offline order queue).
- **IndexedDB / SQLite (mobile app):** Used by the waiter mobile application to store offline order data that is synchronized to the server when connectivity is restored.

These technologies serve a similar purpose to cookies but store more data and are not automatically deleted when you clear your browser cookies. You can clear these through your browser or device settings.

---

## 8. Cookies and Data Security

The essential authentication cookies used by ServeIQ are protected with security features described in our [Privacy Policy](PRIVACY.md#7--data-storage-and-security), including:
- **HttpOnly** attribute (inaccessible to JavaScript)
- **Secure** attribute (sent only over HTTPS)
- **SameSite=Strict** attribute (sent only to first-party requests)

---

## 9. International Users

For users in the European Union and the United Kingdom, this Cookie Policy is provided in compliance with the GDPR and the ePrivacy Directive. For users in Nigeria, this policy aligns with the Nigeria Data Protection Regulation (NDPR). We process cookies in accordance with the data subject rights described in our [Privacy Policy](PRIVACY.md#9--your-rights).

---

## 10. Changes to This Cookie Policy

We may update this Cookie Policy from time to time. When we make material changes, we will update the "Last Updated" date at the top and, when required, notify you via email or in-app notification. We encourage you to review this policy periodically.

---

## 11. Contact Information

If you have any questions about this Cookie Policy or your cookie preferences, please contact us:

| Channel | Details |
|---|---|
| **Email** | privacy@serveiq.io |
| **Security** | security@serveiq.io |
| **Business Address** | ServeIQ Technologies Ltd, Plot 12, Admiralty Road, Lekki Phase 1, Lagos 100001, Nigeria |

---

*Effective Date: 1 August 2026*

**ServeIQ Technologies Ltd**
*1 August 2026*