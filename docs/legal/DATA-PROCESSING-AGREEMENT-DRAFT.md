# Data Processing Agreement (draft)

> **Draft for legal review.** Zander: this was written to match how the platform actually works as at October 2026. Have a South African attorney review it before anyone signs it. Text in square brackets must be completed.

**Between** [Client legal name], registration number [ ] ("the Client"), and **AI Integrity Certification (Pty) Ltd**, registration number [ ] ("AIC").

## 1. Why this agreement exists

The Client uses the AIC platform to keep a record of its AI systems, the people accountable for them, the decisions they make, and evidence of how they are governed. Some of that information is personal information under the Protection of Personal Information Act 4 of 2013 (POPIA).

For information the Client puts into the platform or connects to it, the Client is the **responsible party** and AIC is its **operator** (POPIA section 1). Sections 20 and 21 of POPIA require a written contract between them. This is that contract.

For information AIC collects for its own certification work (for example, an assessor's notes and its certification decisions), AIC is a responsible party in its own right. That information is governed by AIC's Privacy Policy, not by this agreement.

## 2. What AIC processes

| Category | Examples | Source |
|---|---|---|
| Account information | Names, work email addresses and job titles of the Client's users and accountable persons | Entered by the Client |
| Decision records | Decision identifiers, outcomes, whether a human reviewed them, and a pseudonymous reference to the affected person (never their name or ID number) | Sent by the Client's systems |
| Evidence | Documents the Client uploads against a requirement | Uploaded by the Client |
| Connected-system data | Repository names, settings, review and alert records, GitHub usernames of pull-request authors and reviewers, dependency lists, and daily AI usage and cost per model | Read from systems the Client connects |
| Provider keys (only if the Client chooses this option) | A read-only admin key for an AI provider | Given by the Client |

AIC does not need, and the Client agrees not to send, special personal information (POPIA section 26) or information about children, except where a specific assessment requires it and the parties agree that in writing beforehand.

## 3. AIC's obligations

1. **Instructions.** AIC processes the information only to provide the platform and the services the Client has asked for, and only on the Client's documented instructions. Using the platform as designed counts as such an instruction.
2. **Confidentiality.** Everyone at AIC with access to the information is bound to keep it confidential.
3. **Security (POPIA section 19).** AIC maintains the measures described on aiccertified.cloud/security. These include:
   - encryption in transit, and individual encryption of stored secrets;
   - separation of each organisation's data, enforced in the database;
   - role-based staff access, with every administrative change recorded;
   - nightly encrypted off-site backups;
   - automated testing of code changes.

   AIC will not reduce these measures materially during the term.
4. **Sub-operators.** AIC uses the following sub-operators. It will tell the Client of any change in advance, and the Client may object.

   | Sub-operator | Purpose | Location |
   |---|---|---|
   | [Hostinger] | Platform hosting | [ ] |
   | [backup storage provider] | Encrypted backups | [ ] |
   | Resend | Transactional email | [ ] |
   | Sentry | Error reports, with personal information scrubbed where possible | [ ] |

5. **Cross-border transfer (POPIA section 72).** Where a sub-operator is outside South Africa, AIC relies on that sub-operator's binding terms providing an adequate level of protection.
6. **Security compromises (POPIA section 22).** If AIC has reasonable grounds to believe the Client's information has been accessed or acquired by an unauthorised person, it will notify the Client **without undue delay, and in any event within 72 hours** of becoming aware. It will say what happened, which information is affected, and what AIC is doing about it. AIC will help the Client meet its own duty to notify the Information Regulator and the people affected.
7. **Data subjects' requests.** AIC will help the Client respond to requests from data subjects to access or correct their information (POPIA sections 23 and 24).
8. **Return and deletion.** When the Client's subscription ends, AIC will do one of two things within [30] days, as the Client chooses:
   - return the Client's information in a usable format; or
   - delete it.

   Two exceptions apply:
   - AIC keeps what the law or AIC's accreditation obligations require it to keep, for as long as they require.
   - The hash-chained continuity record cannot be edited. It is deleted as a whole or kept as a whole.

   Backups expire on their normal cycle, which is at most [12] months.
9. **Audit.** AIC will make available the information reasonably needed to show it complies with this agreement. That includes this document and the security page.

## 4. The Client's obligations

The Client confirms that it has a lawful basis to give AIC the information, and that it has told the people concerned as POPIA section 18 requires. The Client is responsible for:

- creating, rotating and revoking any provider key it chooses to give AIC; and
- choosing which repositories and accounts it connects.

## 5. Term

This agreement runs for as long as AIC processes the Client's information. Clauses 3.2, 3.6 and 3.8 survive its end.

Signed for the Client: ____________________ Date: __________

Signed for AIC: ____________________ Date: __________
