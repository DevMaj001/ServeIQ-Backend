# Privacy Policy

**Effective Date:** 1 August 2026
**Last Updated:** 1 August 2026
**Platform:** ServeIQ (hospitalityOS-doc)
**Operator:** ServeIQ Technologies Ltd

---

## 1. Introduction

This Privacy Policy explains how **ServeIQ Technologies Ltd** ("we," "us," or "our") collects, uses, stores, shares, and protects personal data when you access or use the **ServeIQ platform** — a hospitality operations platform that helps restaurants, bars, lounges, clubs, and hotels manage orders, billing, staff, and business analytics.

This policy applies to:
- The ServeIQ backend API (`https://serveiq-backend.onrender.com`)
- The ServeIQ admin web application
- The ServeIQ waiter mobile application
- Any related subdomains, integrations, and services

**Please read this policy carefully.** By registering for an account, logging in, or using the ServeIQ platform, you confirm that you have read, understood, and agree to the terms of this Privacy Policy. If you do not agree, you must stop using the platform immediately.

---

## 2. Definitions

| Term | Meaning |
|---|---|
| **Personal Data** | Any information that relates to an identified or identifiable natural person, including names, email addresses, phone numbers, IP addresses, and business identifiers. |
| **Sensitive Personal Data** | Data revealing racial or ethnic origin, political opinions, religious beliefs, health data, biometric data, or financial payment details. |
| **Data Controller** | ServeIQ Technologies Ltd — the entity that determines the purposes and means of processing personal data. |
| **Data Processor** | Any third-party service that processes personal data on our behalf (e.g., Render, Vercel, Cloudinary, PostgreSQL). |
| **Business** | A registered hospitality entity (e.g., a restaurant, bar, or hotel) on the ServeIQ platform. |
| **Branch** | A physical location of a Business registered on ServeIQ. |
| **Staff** | Any user (waiter, manager, supervisor, cashier, owner) registered under a Business. |
| **Customer** | An end-consumer who places an order or visits a Business using the ServeIQ platform. |
| **Super Admin** | The platform-level administrator of ServeIQ. |

---

## 3. Legal Basis for Processing

We process personal data under the following legal bases, depending on the type of data and the purpose:

| Legal Basis | When We Rely On It |
|---|---|
| **Contractual Necessity** | To provide and maintain the ServeIQ services you have signed up for (e.g., creating your business account, processing orders, generating receipts). |
| **Legitimate Interest** | For business analytics, fraud detection, platform security, audit logging, and improving our services. |
| **Legal Obligation** | To comply with applicable laws, regulations, and court orders (e.g., tax reporting, financial reconciliation). |
| **Consent** | For optional features such as marketing communications, email verification, and non-essential data collection. |
| **Vital Interest** | In rare cases where processing is necessary to protect someone's life or safety. |

---

## 4. Data We Collect

### 4.1 Data Collected During Business Registration

When a business owner registers on ServeIQ, we collect the following:

| Data Field | Purpose | Legal Basis |
|---|---|---|
| Full name | Account identification and communication | Contractual Necessity |
| Email address | Account login, authentication, and communication | Contractual Necessity |
| Password (hashed with bcrypt, 12 rounds) | Account security and authentication | Contractual Necessity |
| Business name | Business profile and identification | Contractual Necessity |
| Business type (bar, lounge, restaurant, club, cafe) | Platform configuration and categorization | Contractual Necessity |
| Phone number (optional) | Business contact and communication | Legitimate Interest |
| Business address (optional) | Business profile and location context | Contractual Necessity |
| Business logo (uploaded to Cloudinary) | Business branding and customer-facing display | Consent |
| CAC document (uploaded to Cloudinary, optional) | Business verification and compliance | Legal Obligation |

### 4.2 Data Collected During Staff Registration

When a business owner creates a staff account (waiter, manager, supervisor, cashier, chef), we collect:

| Data Field | Purpose | Legal Basis |
|---|---|---|
| Full name | Staff identification and payroll/performance tracking | Contractual Necessity |
| Email address (optional) | Account login and communication | Contractual Necessity |
| Phone number (optional) | Staff contact and communication | Legitimate Interest |
| PIN (hashed with bcrypt) | Waiter authentication (alternative to email/password) | Contractual Necessity |
| Role assignment | Access control and permissions | Contractual Necessity |
| Avatar URL (optional) | Staff profile display | Consent |
| Invited-by reference | Audit trail for staff provisioning | Legitimate Interest |

### 4.3 Data Collected During Order and Transaction Processing

When customers place orders and businesses process transactions, we collect:

| Data Field | Purpose | Legal Basis |
|---|---|---|
| Customer name (optional, entered by waiter) | Tab identification and receipt generation | Contractual Necessity |
| Customer party size | Table management and service optimization | Contractual Necessity |
| Order items (menu item ID, name snapshot, unit price snapshot, quantity) | Billing, order fulfillment, and historical records | Contractual Necessity |
| Order timestamps (created, approved, preparing, ready, delivered) | Service tracking and performance analytics | Contractual Necessity |
| Tab number (e.g., TAB-2026-00015) | Order tracking and receipt reference | Contractual Necessity |
| Payment method (cash, bank transfer, POS, card) | Financial reconciliation and reporting | Contractual Necessity |
| Payment reference number | Transaction verification and audit trail | Legal Obligation |
| Payment amount | Billing and financial reporting | Contractual Necessity |
| Receipt data (printed or displayed) | Customer record and dispute resolution | Contractual Necessity |

### 4.4 Data Collected Automatically

When you use the ServeIQ platform, we automatically collect certain data:

| Data Type | Purpose | Legal Basis |
|---|---|---|
| IP address | Security monitoring, fraud detection, and audit logging | Legitimate Interest |
| Device type and browser | Platform optimization and analytics | Legitimate Interest |
| Access timestamps | Audit logging and security monitoring | Legitimate Interest |
| Action logs (every CRUD operation on financial records) | Immutable audit trail for accountability and compliance | Legitimate Interest / Legal Obligation |
| JWT access tokens (15-minute expiry) | Session management and authentication | Contractual Necessity |
| Refresh tokens (7-day expiry, stored as SHA-256 hashes in PostgreSQL) | Session persistence and re-authentication | Contractual Necessity |
| Tracking codes (5-character alphanumeric, e.g., `SVQ-ABCD-123`) | Public order tracking without authentication | Contractual Necessity |

### 4.5 Data Collected via Third-Party Integrations

| Integration | Data Shared | Purpose |
|---|---|---|
| **Paystack** (V2+) | Payment reference, amount, status | Payment processing and verification |
| **Cloudinary** | Uploaded images (logos, menu item photos, CAC documents) | File storage and CDN delivery |
| **NVIDIA Nemotron / OpenAI** (V4) | Voice transcripts, menu context | AI-powered voice order capture |
| **Sentry** | Error reports, stack traces (no PII unless included in application code) | Error monitoring and platform stability |
| **PostgreSQL** (hosted by Render) | All business, branch, user, order, and financial data | Primary database storage |
| **Redis** (hosted by Render) | Session cache, rate limiting, pub/sub for real-time updates | Performance and real-time features |
| **Vercel** (frontend hosting) | Domain, traffic patterns | Frontend delivery |
| **Render** (backend hosting) | Server logs, deployment metadata | Backend hosting and runtime |

---

## 5. How We Collect Data

| Collection Method | Description |
|---|---|
| **Direct User Input** | Data entered by business owners, staff, and customers through the web and mobile applications (registration forms, order entry, payment recording, etc.). |
| **Automatic Collection** | Data collected automatically by the platform during normal operation (IP addresses, timestamps, action logs, tracking codes). |
| **File Upload** | Business logos, CAC documents, and menu item images uploaded by business owners via the `/api/v1/upload` endpoint and stored on Cloudinary. |
| **Third-Party Webhooks** | Payment status updates received from Paystack webhooks (V2+). |
| **Offline Sync** | Orders placed by waiters while offline are stored locally on the device (SQLite) and synchronized to the server when connectivity is restored. |

---

## 6. How We Use Your Data

We use your personal data for the following purposes:

### 6.1 Core Platform Operations
- Creating and managing business accounts, branches, and staff
- Processing orders, bills, and payments
- Generating and delivering receipts (screen display, PDF download, thermal printer output)
- Managing tables, menus, and inventory
- Real-time order tracking and status updates
- Offline data synchronization

### 6.2 Authentication and Security
- Authenticating users via email/password or PIN
- Managing JWT access and refresh tokens
- Detecting and preventing unauthorized access
- Rate limiting and brute-force protection
- Password reset and email verification
- Impersonation logging (super admin only, for troubleshooting)

### 6.3 Business Analytics and Reporting
- Sales dashboards and revenue tracking
- Waiter performance summaries
- Shift closing reports and cash reconciliation
- Popular item analysis and peak hour identification
- Inventory variance reporting (V2+)
- Financial reconciliation (V3+)

### 6.4 Platform Improvement
- Analyzing usage patterns to improve user experience
- Identifying and fixing bugs
- Developing new features based on aggregate, anonymized data
- AI-powered insights (V4): restock suggestions, waste analysis, fraud detection

### 6.5 Legal and Compliance
- Maintaining immutable audit logs for financial accountability
- Complying with tax reporting obligations
- Responding to legal requests and law enforcement inquiries
- Enforcing platform terms of service
- Preventing and detecting fraud, money laundering, and financial crime

### 6.6 Communication
- Sending account-related notifications (password reset, email verification)
- In-app alerts and notifications for order updates
- Platform announcements and service updates (with consent where required)

---

## 7. Data Storage and Security

### 7.1 Where We Store Data

| Data Type | Storage Location | Provider |
|---|---|---|
| All primary data (users, businesses, branches, orders, payments, tabs, audit logs) | PostgreSQL database | Render (hosted) |
| Session cache and real-time data | Redis | Render (hosted) |
| Uploaded files (logos, images, documents) | Cloudinary | Cloudinary Inc. |
| Error and performance monitoring | Sentry | Sentry.io |
| Frontend application | Vercel CDN | Vercel Inc. |
| Backend application | Containerized runtime | Render Inc. |
| AI processing (V4) | NVIDIA API endpoints | NVIDIA Corporation |
| Payment processing (V2+) | Paystack API | Paystack Ltd |

### 7.2 Security Measures

We implement the following technical and organizational measures to protect your personal data:

- **Encryption at Rest:** PostgreSQL data is stored on encrypted volumes provided by Render.
- **Encryption in Transit:** All API communication occurs over HTTPS/TLS. The frontend communicates with the backend exclusively over HTTPS.
- **Password Hashing:** All passwords are hashed using **bcrypt** with a cost factor of **12 rounds**. PINs are similarly hashed with bcrypt.
- **Token Security:** JWT access tokens expire after **15 minutes**. Refresh tokens expire after **7 days** and are stored as **SHA-256 hashes** in the database (never stored in plaintext). Tokens are transmitted via **HttpOnly, Secure, SameSite=Strict** cookies.
- **Data Isolation:** Every database query is scoped to `business_id` and `branch_id`. No endpoint returns cross-business data. Multi-tenancy is enforced at the data access layer.
- **Rate Limiting:** The platform enforces a rate limit of **300 requests per minute** per IP address. Authentication endpoints have additional throttling (e.g., 5 failed login attempts triggers a 15-minute lockout).
- **Audit Logging:** Every financial mutation (order creation, voiding, payment recording, price changes, user management) is recorded in an **immutable audit log** with no delete endpoint.
- **Security Headers:** The API uses **Helmet.js** to set security-related HTTP headers (X-Content-Type-Options, X-Frame-Options, HSTS, etc.).
- **Input Validation:** All API inputs are validated using `class-validator` and NestJS `ValidationPipe` with whitelist mode enabled.
- **CORS Protection:** Cross-origin requests are restricted to explicitly allowed origins only.
- **Soft Deletes:** Financial records are never hard-deleted. They are soft-deleted using `deleted_at` timestamps, preserving the audit trail.
- **No PII in Logs:** Application logs do not intentionally log passwords, PINs, full payment card numbers, or authentication tokens.

### 7.3 Data Retention

| Data Type | Retention Period | Reason |
|---|---|---|
| Active business, staff, and order data | As long as the account is active and subscribed | Contractual Necessity |
| Audit logs | Indefinite (immutable, no deletion) | Legal obligation for financial accountability |
| Deactivated user accounts | 90 days after deactivation, then permanently deleted | Data minimization |
| Deactivated businesses | 90 days after deactivation, then permanently deleted | Data minimization |
| Verification tokens (email, password reset) | 10 minutes to 1 hour after creation, then auto-expired | Security |
| Refresh tokens | 7 days from creation, or until revoked | Session management |
| Sync queue entries (offline) | 30 days after successful sync, then purged | Data minimization |
| Archived financial records (voided tabs, closed orders) | 7 years from last activity | Tax and financial regulation compliance |

---

## 8. Data Sharing and Disclosure

### 8.1 We Do NOT Sell Your Data

We do not sell, rent, or trade your personal data to any third party for marketing or commercial purposes.

### 8.2 Data We Share

| Recipient | Data Shared | Purpose | Legal Basis |
|---|---|---|---|
| **Render** (hosting) | Database contents, server logs | Platform hosting and operation | Contractual Necessity |
| **Vercel** (frontend hosting) | Application assets, domain traffic | Frontend delivery | Contractual Necessity |
| **Cloudinary** | Uploaded images and documents | File storage and CDN | Contractual Necessity |
| **PostgreSQL** (database provider) | All structured data | Database hosting | Contractual Necessity |
| **Redis** (cache provider) | Session data, cache entries | Performance optimization | Contractual Necessity |
| **Sentry** | Error reports (no PII unless app code includes it) | Error monitoring | Legitimate Interest |
| **Paystack** (V2+) | Payment reference, amount, status | Payment processing | Contractual Necessity |
| **NVIDIA / OpenAI** (V4) | Voice transcripts, menu context (no customer PII) | AI voice order processing | Consent (opt-in) |
| **Law enforcement / Courts** | Data as required by law | Legal compliance | Legal Obligation |
| **Business Owner** (within their own business) | All data within their business scope | Business operations | Contractual Necessity |
| **Staff** (within their assigned branch) | Data relevant to their role and permissions | Business operations | Contractual Necessity |

### 8.3 Cross-Border Data Transfers

Your data may be transferred to and processed in countries other than your country of residence, including:
- **United States** (Render, Vercel, Cloudinary, Sentry, NVIDIA)
- **Nigeria** (primary data center region for Render)

We ensure that appropriate safeguards are in place for such transfers, including contractual obligations on our data processors to maintain data protection standards consistent with this policy and applicable laws.

---

## 9. Your Rights

Depending on your jurisdiction (particularly if you are in the European Union, United Kingdom, or other jurisdictions with data protection laws), you have the following rights regarding your personal data:

| Right | Description | How to Exercise |
|---|---|---|
| **Right of Access** | You can request a copy of all personal data we hold about you. | Contact us at the email address below. |
| **Right to Rectification** | You can request correction of inaccurate or incomplete personal data. | Contact us at the email address below. |
| **Right to Erasure ("Right to be Forgotten")** | You can request deletion of your personal data, subject to legal and contractual obligations. | Contact us at the email address below. |
| **Right to Restriction of Processing** | You can request that we limit how we process your data. | Contact us at the email address below. |
| **Right to Data Portability** | You can request a machine-readable copy of your data to transfer to another service. | Contact us at the email address below. |
| **Right to Object** | You can object to processing based on legitimate interest, direct marketing, or automated decision-making. | Contact us at the email address below. |
| **Right to Withdraw Consent** | You can withdraw consent for processing based on consent at any time. Withdrawal does not affect the lawfulness of processing done before withdrawal. | Contact us at the email address below. |
| **Right to Lodge a Complaint** | You have the right to lodge a complaint with your local data protection authority (e.g., the Information Commissioner's Office (ICO) in the UK, or the National Information Technology Development Agency (NITDA) in Nigeria). | Contact the relevant authority directly. |

### 9.1 How to Exercise Your Rights

To exercise any of the rights listed above, please contact us at:

- **Email:** privacy@serveiq.io
- **Address:** Plot 12, Admiralty Road, Lekki Phase 1, Lagos 100001, Nigeria
- **Response Time:** We will respond to all valid requests within **30 days** of receipt.

When making a request, please include:
1. Your full name
2. The email address or business code associated with your account
3. The specific right you wish to exercise
4. Any relevant details or supporting information

We may request additional information to verify your identity before processing your request.

---

## 10. Children's Privacy

The ServeIQ platform is not intended for use by individuals under the age of **16** (or the age of digital consent applicable in your jurisdiction). We do not knowingly collect personal data from children. If we become aware that a child has provided us with personal data, we will take immediate steps to delete such data.

---

## 11. Cookies and Tracking Technologies

The ServeIQ platform uses the following cookies and tracking technologies:

| Technology | Type | Purpose | Duration |
|---|---|---|---|
| `access_token` (cookie) | HTTP-only, Secure cookie | JWT authentication token | 15 minutes |
| `refresh_token` (cookie) | HTTP-only, Secure cookie | JWT refresh token for session persistence | 7 days |
| `_ga` / `_gid` (if analytics enabled) | Analytics cookie | Usage analytics (if implemented) | 24 months / 24 hours |

The ServeIQ platform does **not** use third-party tracking pixels, social media tracking cookies, or advertising cookies. The customer-facing menu (public tracking page) does not set any cookies or require authentication.

For more details, see our [Cookie Policy](COOKIE_POLICY.md).

---

## 12. Third-Party Services and Links

The ServeIQ platform integrates with the following third-party services. Please note that we are not responsible for the privacy practices of third-party services. We encourage you to review the privacy policies of each service:

| Service | Privacy Policy |
|---|---|
| Render (hosting) | https://render.com/privacy |
| Vercel (frontend) | https://vercel.com/privacy |
| Cloudinary (file storage) | https://cloudinary.com/privacy |
| PostgreSQL (database) | https://www.postgresql.org/about/legal/ |
| Sentry (error monitoring) | https://sentry.io/privacy/ |
| Paystack (payments, V2+) | https://paystack.com/privacy |
| NVIDIA (AI, V4) | https://www.nvidia.com/en-us/privacy/ |
| OpenAI (AI, V4) | https://openai.com/policies/privacy-policy |

---

## 13. Data Breach Notification

In the event of a confirmed personal data breach, we will:

1. **Notify affected users** within **72 hours** of becoming aware of the breach, where feasible and where the breach is likely to result in a high risk to their rights and freedoms.
2. **Notify relevant supervisory authorities** as required by applicable law (e.g., NITDA in Nigeria, ICO in the UK).
3. **Document the breach** internally, including the nature of the breach, the categories and approximate number of individuals affected, the measures taken, and the remediation plan.
4. **Take immediate technical and organizational measures** to contain and remediate the breach.

You can contact our security team at: **security@serveiq.io**

---

## 14. International Data Protection Laws

### 14.1 Nigeria — Nigeria Data Protection Regulation (NDPR)

ServeIQ complies with the Nigeria Data Protection Regulation (NDPR) 2023. We:
- Process personal data lawfully and transparently
- Implement appropriate technical and organizational security measures
- Maintain records of data processing activities
- Notify the National Information Technology Development Agency (NITDA) of data breaches
- Respect data subject rights as defined under the NDPR

### 14.2 European Union — General Data Protection Regulation (GDPR)

For users in the European Union, ServeIQ complies with the GDPR. Our legal bases for processing are as described in Section 3. We have appointed a Data Protection Officer (DPO) whom you can contact at: **dpo@serveiq.io**

### 14.3 United Kingdom — UK GDPR and Data Protection Act 2018

For users in the United Kingdom, we comply with the UK GDPR and the Data Protection Act 2018.

### 14.4 Other Jurisdictions

For users in other jurisdictions, we comply with applicable local data protection laws, including but not limited to:
- South Africa: Protection of Personal Information Act (POPIA)
- Kenya: Data Protection Act (2019)

---

## 15. Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect changes in our data practices, legal requirements, or platform features.

- We will **notify users** of material changes via email, in-app notification, or a prominent notice on the platform.
- The **"Last Updated"** date at the top of this policy will be revised whenever changes are made.
- **Material changes** will be highlighted and explained in the update notification.
- **Non-material changes** (e.g., clarifications, formatting) will take effect immediately upon publication.

We encourage you to review this policy periodically.

---

## 16. Contact Information

If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:

| Channel | Details |
|---|---|
| **Email** | privacy@serveiq.io |
| **Security** | security@serveiq.io |
| **Data Protection Officer** | dpo@serveiq.io |
| **Business Address** | Plot 12, Admiralty Road, Lekki Phase 1, Lagos 100001, Nigeria |
| **Website** | https://serveiq.io |
| **API Documentation** | https://serveiq-backend.onrender.com/api/docs |
| **Response Time** | Within 30 days of receipt |

---

## 17. Glossary

| Term | Definition |
|---|---|
| **bcrypt** | A password hashing function that uses a salt and adaptive cost factor to securely store passwords. |
| **JWT (JSON Web Token)** | A compact, URL-safe token used for authentication and authorization between the client and server. |
| **HttpOnly Cookie** | A cookie that cannot be accessed by JavaScript, reducing the risk of cross-site scripting (XSS) attacks. |
| **SameSite=Strict** | A cookie attribute that prevents the cookie from being sent in cross-site requests, mitigating CSRF attacks. |
| **SHA-256** | A cryptographic hash function used to securely store refresh token hashes. |
| **Immutable Audit Log** | A log entry that cannot be modified or deleted once written, ensuring a permanent record of all financial and security-relevant actions. |
| **Multi-Tenancy** | An architecture where multiple businesses (tenants) share the same platform infrastructure while their data is logically isolated. |
| **Soft Delete** | A deletion method that marks a record as deleted (using `deleted_at`) without actually removing it from the database. |
| **UUID** | A Universally Unique Identifier used as the primary key for all database records, ensuring global uniqueness without sequential numbering. |

---

## 18. Consent Acknowledgment

By using the ServeIQ platform, you acknowledge that you have read, understood, and agree to this Privacy Policy. If you do not agree with any part of this policy, you must discontinue use of the platform immediately.

---

*This Privacy Policy is effective as of 1 August 2026 and remains in effect until superseded by a newer version.*

**ServeIQ Technologies Ltd**
*1 August 2026*
