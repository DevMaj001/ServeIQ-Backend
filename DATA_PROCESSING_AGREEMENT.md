# Data Processing Agreement (DPA)

**Effective Date:** 1 August 2026
**Last Updated:** 1 August 2026
**Operator:** ServeIQ Technologies Ltd ("Data Processor")
**Communications:** This DPA is entered into between ServeIQ Technologies Ltd ("ServeIQ," the "Processor") and the customer (the "Controller") who uses the ServeIQ hospitality operations platform.

---

## 1. Introduction

This Data Processing Agreement (this "DPA") forms part of and is incorporated into the [Terms of Service](TERMS_OF_SERVICE.md) between ServeIQ Technologies Ltd ("ServeIQ," "we," "Processor") and the business customer ("you," "Controller"). This DPA sets out the terms on which ServeIQ processes Personal Data on behalf of the Controller when the Controller uses the ServeIQ platform and related services.

For the purposes of this DPA:
- **"Controller"** means the person or entity that determines the purposes and means of processing Personal Data. In the context of the ServeIQ platform, this is typically the registered business (the restaurant, bar, hotel, etc.) and its authorized representatives.
- **"Processor"** means ServeIQ, the entity that processes Personal Data on behalf of the Controller.
- **"Personal Data"** has the meaning given to it under applicable data protection law, including the GDPR, UK GDPR, the Nigeria Data Protection Regulation (NDPR), and the South African POPIA.
- **"Data Subject"** means an identified or identifiable natural person whose Personal Data is processed.

This DPA applies whenever the Controller (itself or through its staff) uses the platform to process Personal Data of Data Subjects, including their staff members and end customers.

---

## 2. Roles and Responsibilities

### 2.1 Roles

| Party | Role | Responsibility |
|---|---|---|
| **Controller** (you) | Determines purposes and means of processing | Decides what data to collect, why it is collected, and how it is used. Owns the data. |
| **ServeIQ** (Processor) | Processes data on instructions of the Controller | Handles, stores, and manages the data solely in accordance with the Controller's instructions and this DPA. |

### 2.2 Controller Responsibilities

The Controller is responsible for:
1. **Lawful Basis:** Ensuring it has a valid legal basis (e.g., consent, contract) to collect and process the Personal Data it loads onto the platform.
2. **Notice:** Providing Data Subjects (customers, staff) with appropriate privacy notices and lawful access to information about how their data is processed.
3. **Data Quality:** Ensuring the accuracy and lawfulness of the Personal Data it uploads or processes.
4. **Compliance:** Ensuring its own activities comply with applicable data protection laws.
5. **Responses to Data Subjects:** Responding to data subject requests (access, rectification, erasure, etc.) — ServeIQ will assist, but the Controller is primarily responsible for responding.

---

## 3. Details of Processing

Section 3.1 describes the subject matter, duration, nature, and purpose of the processing and the categories of Personal Data processed.

| Element | Details |
|---|---|
| **Categories of Data Subjects** | Business owners and managers; staff (waiters, supervisors, managers, cashiers, chefs); end customers of hospitality businesses. |
| **Categories of Personal Data** | Names, email addresses, phone numbers, business contact details, customer names and party sizes, PINs (hashed), order and transaction data, payment references, IP addresses, device information, audit logs, and uploaded files (logos, images, documents). |
| **Special categories** | ServeIQ does not intentionally process special category (sensitive) data. The Controller is responsible for not uploading sensitive data without a lawful basis. |
| **Nature and Purpose of Processing** | To provide, operate, secure, and improve the ServeIQ hospitality operations platform, including order management, billing, payment recording, staff management, analytics, reporting, and customer order tracking. |
| **Retention** | As set out in the [Privacy Policy](PRIVACY.md#7--data-storage-and-security) — active data retained while the account is active; deactivated data deleted after 90 days; financial records retained as required by law. |
| **Processor location** | Data processed on infrastructure provided by Render and stored in the region(s) described in the [Privacy Policy](PRIVACY.md#7--data-storage-and-security) |

---

## 4. Processor Obligations

ServeIQ will not:
- Process Personal Data other than on documented instructions of the Controller, unless required to do so by applicable law (in which case ServeIQ shall inform the Controller of that legal requirement before processing, unless that law prohibits such information on important grounds of public interest).
- Sell or rent Personal Data to any third party.
- Use Personal Data for any purpose other than providing and operating the platform for the Controller.

ServeIQ shall:
- Process Personal Data in accordance with this DPA, the [Terms of Service](TERMS_OF_SERVICE.md), and the [Privacy Policy](PRIVACY.md).
- Ensure that personnel authorized to process Personal Data are subject to appropriate confidentiality obligations.
- Notify the Controller without undue delay if ServeIQ determines that a processing instruction violates applicable data protection law.
- Implement and maintain appropriate technical security measures as described in the [Privacy Policy](PRIVACY.md#7--data-storage-and-security).
- Provide reasonable assistance to the Controller in responding to Data Subject requests, to the extent necessary under applicable law.
- Provide reasonable assistance on data security obligations, breach notifications, and, where applicable, data protection impact assessments.

---

## 5. Sub-Processors

The Controller authorizes ServeIQ to engage the following sub-processors to process Personal Data, and acknowledges that ServeIQ may list further sub-processors from time to time upon notification:

| Sub-Processor | Role/Location | Purpose | Data Processed |
|---|---|---|---|
| **Render** (US/global) | Hosting | Backend hosting and databases | All platform data |
| **Vercel** (US) | Frontend hosting | Application delivery | Network/traffic metadata |
| **Cloudinary** (US) | File storage | Hosting uploads (logos, images) | Uploaded files |
| **PostgreSQL provider** (via Render) | Database | Structured storage | All structured data |
| **Redis provider** (via Render) | Cache | Session/caching | Cache entries |
| **Sentry** (US) | Error monitoring | Error reporting | Error events |
| **Paystack** (NG / global, V2+) | Payment processor | Payment and subscription processing | Payment data |
| **NVIDIA / OpenAI** (global, V4) | AI processing | AI features | Processed transcripts/menu context |

The Controller may object in writing to our use of any new sub-processor for reasonable and good-faith data protection reasons, within 30 days of notice. If we cannot provide a reasonable alternative, the Controller may terminate their account.

---

## 6. Data Subject Rights

### 6.1 Subject Requests

The Controller may, from time to time, receive requests from Data Subjects concerning their personal data, including requests to access, correct, amend, delete, or restrict the processing of their Personal Data (data subjects' rights). ServeIQ shall provide reasonable cooperation and assistance to enable the Controller to respond to such requests.

Where a Data Subject makes a request directly to ServeIQ in respect of the Controller's data, ServeIQ shall, where lawful, notify the Controller in a timely manner and shall not respond to such a request before the Controller has been given a reasonable opportunity to respond, unless legally required to do so.

### 6.2 Controller Obligations

The Controller is responsible for providing final responses to data subject requests and for ensuring lawful and complete responses.

---

## 7. Security of Processing

### 7.1 Technical Security Measures

ServeIQ shall implement and maintain appropriate technical and organizational measures to protect Personal Data, including (at minimum) those described in the [Privacy Policy](PRIVACY.md#7--data-storage-and-security):

- Encryption in transit (TLS/HTTPS)
- Password and PIN hashing with bcrypt (cost factor 12)
- JWT access and refresh tokens with HttpOnly/Secure/SameSite cookies
- Multi-tenant data isolation by business_id and branch_id
- Rate limiting (ThrottlerModule, 300 req/min default)
- Immutable, non-deletable audit logs
- Helmet security headers
- Input validation and whitelisting
- Soft-delete of financial records
- IP-based access controls where applicable

### 7.2 Confidentiality

ServeIQ shall ensure that the personnel and administrators who have access to the Controller's Personal Data are subject to applicable professional confidentiality and data protection commitments.

### 7.3 Audits

Upon reasonable written notice by the Controller (not more than once per year, unless a data breach or legal or professional grounds (including regulatory request) require more frequent), ServeIQ shall reasonable cooperate with the Controller's audits of ServeIQ's processing that are proportionate to ServeIQ's obligations under this DPA. Any audit may be restricted:

- to reasonable audit steps consistent with the platform's infrastructure,
- to avoid the disclosure of ServeIQ's confidential data and the data of other controllers,
- to be carried out in a manner that minimizes disruption.

---

## 8. Notification of Personal Data Breach

### 8.1 Reporting

ServeIQ shall notify the Controller **without undue delay** after becoming aware of an accidental or unlawful destruction, loss, alteration, unauthorized disclosure of, or access to, Personal Data transmitted, stored or otherwise processed by ServeIQ that compromises the confidentiality, integrity, or availability of that data.

### 8.2 What we include in notification

The notification shall include, where available and reasonable:
- The nature of the breach, including categories and approximate numbers of data subjects and records involved.
- The likely consequence of the breach.
- The measures taken or proposed to address the breach, including to mitigate its possible adverse effects.
- The detail of a point of contact.

### 8.3 Compliance

The Controller is responsible for notifying supervisory authorities and affected data subjects of any breach-notification obligations under law. ServeIQ shall assist the Controller in this responsibility as reasonably required, including by providing information in ServeIQ's possession that is reasonably necessary for the purpose.

---

## 9. Retention and Deletion of Data

### 9.1 Retention

Personal Data will be used and retained in accordance with the retention schedule set out in the [Privacy Policy](PRIVACY.md#7--data-storage-and-security), which is incorporated by reference.

### 9.2 Deletion on termination of Account

Following termination of the Controller's account or Terms of Service, ServeIQ will, on the Controller's request submitted within the applicable timeframe:
- Provide the Controller with a reasonable opportunity to export their Personal Data (data portability), and
- Unless prohibited by law, delete (or erase) the Controller's Personal Data from ServeIQ's systems (including all back-ups) if the data is declared eligible for deletion under the retention schedule, and notify the Controller that the deletion has been completed.

For any data that cannot be deleted (e.g., financial records retained for tax compliance or audit records), ServeIQ will continue to process that data, restricted to the extent necessary for the legal retention requirement, and will inform the Controller.

---

## 10. Cross-Border Transfers

To the extent ServeIQ transfers Personal Data from the Controller to third-party sub-processors located outside the jurisdiction where the data was collected, ServeIQ shall:

- Ensure such transfers are carried out in compliance with applicable data protection law;
- Use Standard Contractual Clauses (SCCs) or another lawful transfer mechanism approved by an applicable regulating authority;
- Ensure the sub-processor agrees to provide a standard of protection for the data that is at least at the same level required by applicable data protection law;

---

## 11. Term and Termination

- This DPA shall remain in effect for so long as it is needed to support the [Terms of Service](TERMS_OF_SERVICE.md), and until the termination of the Terms of Service or this DPA.
- Any and all clauses that by their nature should survive termination, including the Controller's consent to sub-processing and the limitation of liability, shall remain in effect after termination.


---

## 12. Survival and Liability

### 12.1 Liability

The liability of each party under this DPA shall be subject to the limitations and exclusions of liability clause set out in the [Terms of Service](TERMS_OF_SERVICE.md) (section 10, "Limitation of Liability") and shall not be modified except as required by law. The Controller's aggregate liability under this DPA shall be subject to the limitations in the [Terms of Service](TERMS_OF_SERVICE.md).

### 12.2 Survival

These provisions related data protection, confidentiality, liability, and termination shall survive the termination of this DPA where their survival is necessary to give effect to the parties' relevant rights and obligations.

---

## 13. Contact Information

For any query concerning this DPA or any of our data processing:

| Channel | Details |
|---|---|
| **Email** | legal@serveiq.io |
| **DPO** | dpo@serveiq.io |
| **Business Address** | ServeIQ Technologies Ltd, Plot 12, Admiralty Road, Lekki Phase 1, Lagos 100001, Nigeria |

---

*Effective Date: 1 August 2026*

**ServeIQ Technologies Ltd**
*1 August 2026*