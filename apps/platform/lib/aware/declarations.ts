/**
 * The two declarations an AIC Aware badge rests on, versioned.
 *
 * DRAFT: written by Claude for Zander to edit and, ideally, for a lawyer to
 * read before launch. Change the text here only; bump the version whenever the
 * meaning changes, because accountable_persons.declaration_version records
 * which wording each person actually accepted.
 */

export const ACCOUNTABLE_PERSON_DECLARATION = {
  version: '2026-10-draft',
  /** Shown beside the checkbox when an accountable person is named. */
  text: (orgName: string) =>
    `I confirm that the person named above has agreed to be named as the individual accountable for ${orgName}'s use of AI in decisions that affect people. ` +
    `They have the authority to oversee how those decisions are made, to pause or change an AI system that is causing harm, and to make sure people who challenge a decision are heard. ` +
    `AIC keeps their name on its records; the public registry shows only that a named person is accountable.`,
};

export const SUBMISSION_ATTESTATION = {
  version: '2026-10-draft',
  text: (orgName: string, personName: string) =>
    `On behalf of ${orgName}, I confirm that these answers are a true and complete account of how we use AI today, to the best of my knowledge after reasonable enquiry, ` +
    `and that ${personName} is accountable for it. I understand that AIC Aware is a self-declaration, not certification or an independent audit; that the badge is valid for twelve months; ` +
    `and that AIC may revoke it if the declaration proves untrue, if the badge is used outside the AIC Aware badge rules, or if ${personName} is no longer accountable.`,
};

export const BADGE_RULES_URL = 'https://aiccertified.cloud/aware/badge-rules';
