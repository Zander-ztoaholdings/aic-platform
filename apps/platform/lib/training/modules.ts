/**
 * AIC's built-in training. Short on purpose: each module takes about ten
 * minutes, says what to do rather than reciting the law, and ends with four
 * questions. Passing means three of four right; anyone can retake it.
 *
 * Content is written for South African organisations first (POPIA), and the
 * AI module covers the "AI literacy" duty in Article 4 of the EU AI Act.
 * Changing a module's substance means changing its version.
 */

export type TrainingQuestion = { q: string; options: string[]; answer: number; why: string };
export type TrainingModule = {
  key: string; version: string; title: string; summary: string; minutes: number;
  audience: 'everyone' | 'reviewers';
  controls: string[];
  sections: { heading: string; body: string[] }[];
  quiz: TrainingQuestion[];
};

export const PASS_MARK = 0.75;

export const MODULES: TrainingModule[] = [
  {
    key: 'security-basics', version: '2026.1', title: 'Security basics', minutes: 10, audience: 'everyone',
    summary: 'Passwords, second factors, phishing, devices, and what to do when something goes wrong.',
    controls: ['ops.awareness_training', 'iam.mfa', 'ops.incident_response'],
    sections: [
      { heading: 'Your accounts', body: [
        'Use a different password for every system, and keep them in the company password manager. A reused password turns one leak into many.',
        'Turn on a second factor wherever it is offered: an authenticator app or a security key. A text message is better than nothing but can be redirected.',
        'Never share an account, even with a colleague for a minute. Ask for your own access instead.',
      ] },
      { heading: 'Phishing', body: [
        'Most break-ins start with a message that looks routine: an invoice, a shared document, a password expiry, a parcel.',
        'Before you click or sign in, check who really sent it and where the link really goes. When in doubt, open the site yourself rather than through the link.',
        'A request to change bank details, buy gift cards or bypass a process is a warning sign, however senior the sender appears. Confirm it by phone on a number you already have.',
      ] },
      { heading: 'Devices', body: [
        'Keep your laptop and phone locked when you step away, encrypted, and up to date. Updates close holes that attackers already know about.',
        'Work information stays on work systems. Do not forward it to personal email or store it on personal cloud accounts.',
      ] },
      { heading: 'When something goes wrong', body: [
        'If you clicked a bad link, lost a device, sent information to the wrong person or see something odd, report it straight away to the person named in the incident response policy.',
        'Reporting early is never held against you. The first hour matters most, and you are not expected to investigate it yourself.',
      ] },
    ],
    quiz: [
      { q: 'An email from the CEO asks you to change a supplier’s bank details today. What do you do?', options: ['Change them; it is from the CEO', 'Reply to the email to confirm', 'Call the CEO or the supplier on a number you already have', 'Forward it to the supplier'], answer: 2, why: 'Payment changes are confirmed out of band. Replying confirms nothing if the mailbox is spoofed or taken over.' },
      { q: 'Which second factor is strongest?', options: ['A text message code', 'An authenticator app or security key', 'A security question', 'A second password'], answer: 1, why: 'App codes and keys cannot be redirected the way text messages can.' },
      { q: 'You clicked a link and entered your password before realising it was fake. What now?', options: ['Wait and see', 'Change the password and report it straight away', 'Delete the email', 'Tell a colleague'], answer: 1, why: 'Change it and report it at once; the response team can check for misuse.' },
      { q: 'Where should a work password be kept?', options: ['A note on the desk', 'The browser of a shared computer', 'The company password manager', 'A spreadsheet on your desktop'], answer: 2, why: 'The password manager encrypts it and lets you use unique passwords everywhere.' },
    ],
  },
  {
    key: 'popia-essentials', version: '2026.1', title: 'POPIA essentials', minutes: 12, audience: 'everyone',
    summary: 'What personal information is, the conditions for using it lawfully, and what to do if it leaks.',
    controls: ['ops.awareness_training', 'priv.lawful_basis', 'ops.breach_notification', 'priv.subject_rights'],
    sections: [
      { heading: 'What counts', body: [
        'Personal information is anything about an identifiable person: a name with an ID number, contact details, account numbers, opinions about them, their history with us. In South Africa it also covers companies.',
        'Special personal information needs extra care: religious or philosophical beliefs, race or ethnic origin, trade union membership, political persuasion, health or sex life, biometric information, and criminal behaviour.',
      ] },
      { heading: 'The eight conditions', body: [
        'POPIA sets eight conditions for lawful processing: accountability, processing limitation, purpose specification, further processing limitation, information quality, openness, security safeguards, and data subject participation.',
        'In practice: collect only what you need for a stated purpose, use it only for that purpose or a compatible one, keep it accurate, keep it secure, keep it no longer than needed, and tell people what you are doing with it.',
      ] },
      { heading: 'People’s rights', body: [
        'People can ask what we hold about them, ask for corrections or deletion, and object to some uses. Pass any such request to the Information Officer straight away; there are deadlines.',
        'Under section 71, a person may not be subject to a decision with legal or substantial effect based solely on automated processing, except with safeguards: they can make representations, and get enough information about the logic behind the decision.',
      ] },
      { heading: 'When it leaks', body: [
        'If personal information may have been accessed or acquired by someone without authority, section 22 requires us to notify the Information Regulator and the people affected as soon as reasonably possible.',
        'That clock only starts if you tell someone. Report a suspected leak immediately, even if you are not sure.',
      ] },
    ],
    quiz: [
      { q: 'Which of these is special personal information?', options: ['A work email address', 'A customer’s health condition', 'A company’s registration number', 'A delivery address'], answer: 1, why: 'Health is special personal information and needs extra protection.' },
      { q: 'A customer asks what information we hold about them. What do you do?', options: ['Ignore it', 'Send everything you can find yourself', 'Pass it to the Information Officer straight away', 'Ask them to put it in a letter first'], answer: 2, why: 'The Information Officer handles access requests, which have deadlines.' },
      { q: 'You emailed a spreadsheet of customer details to the wrong person. When should it be reported?', options: ['Only if they complain', 'Immediately', 'At the next team meeting', 'Only if it contained ID numbers'], answer: 1, why: 'Section 22 notification runs from when we become aware; report at once.' },
      { q: 'Under section 71, what must a person affected by a solely automated decision be able to do?', options: ['Nothing', 'Make representations and understand the logic behind it', 'Choose the algorithm', 'Delete the system'], answer: 1, why: 'They must be able to make representations and receive enough information about the underlying logic.' },
    ],
  },
  {
    key: 'ai-at-work', version: '2026.1', title: 'Using AI at work', minutes: 10, audience: 'everyone',
    summary: 'Which AI tools to use, what never to put into them, and why a person stays accountable.',
    controls: ['ops.awareness_training', 'gov.ai_policy', 'ai.human_oversight'],
    sections: [
      { heading: 'Approved tools only', body: [
        'Use the AI tools on our approved list, with your work account. A personal account of the same tool may keep your input and train on it.',
        'If you want a new tool, ask the person who keeps the approved list. They check where the data goes before it is used for work.',
      ] },
      { heading: 'What not to put in', body: [
        'No passwords, keys or other credentials, ever.',
        'No personal information about customers, applicants or colleagues unless the tool is approved for it and the use is recorded in our AI inventory.',
        'Nothing confidential that you would not send to an outside supplier.',
      ] },
      { heading: 'Check the output', body: [
        'AI tools write fluently and are sometimes confidently wrong. Check facts, figures, names and references before you rely on them or send them on.',
        'You are responsible for what you send or decide, whether or not an AI drafted it.',
      ] },
      { heading: 'Decisions about people', body: [
        'An AI system may help prepare a decision about a person, such as credit, hiring or a claim, only if that use is declared with a named accountable person.',
        'No decision with a legal or similarly significant effect on someone is left to an AI alone. A trained person reviews it and can change it, and the change is recorded with a reason.',
      ] },
    ],
    quiz: [
      { q: 'You want to summarise a long customer complaint with an AI tool. What must be true?', options: ['Any free tool is fine', 'The tool is approved for personal information and the use is recorded', 'Use your personal account', 'Remove only the surname'], answer: 1, why: 'Customer details go only into tools approved for them, with the use recorded.' },
      { q: 'An AI tool gives you a legal reference for a report. What do you do?', options: ['Use it as is', 'Check the reference exists and says what is claimed', 'Ask the tool if it is sure', 'Leave the reference out'], answer: 1, why: 'AI output can be wrong; you check it before relying on it.' },
      { q: 'Can an AI system decline a loan on its own?', options: ['Yes, if it is accurate', 'Only at night', 'No: a person reviews decisions with significant effect and can change them', 'Yes, if the customer agreed to the terms'], answer: 2, why: 'A person stays meaningfully involved and accountable.' },
      { q: 'Which of these may never go into an AI tool?', options: ['A public press release', 'An API key', 'A meeting agenda', 'A draft blog post'], answer: 1, why: 'Credentials never go into an AI tool.' },
    ],
  },
  {
    key: 'reviewing-decisions', version: '2026.1', title: 'Reviewing automated decisions', minutes: 8, audience: 'reviewers',
    summary: 'For people who approve or override decisions an AI system makes: what a real review looks like.',
    controls: ['ops.awareness_training', 'ai.human_oversight', 'ai.decision_logging'],
    sections: [
      { heading: 'A review is a decision', body: [
        'When a system holds a decision for you, you are making it. Look at what the system was given and why it decided, and ask what it could not have known.',
        'Approving everything without looking is not oversight. An override rate near zero across many decisions is a warning sign the assessor will ask about.',
      ] },
      { heading: 'Overriding well', body: [
        'Override when the system lacked information, the data was wrong, the person’s circumstances warrant it, or an exception was approved.',
        'Choose the reason honestly and add detail where it helps someone later understand your call. The record carries your name.',
      ] },
      { heading: 'When to escalate', body: [
        'If the same kind of error keeps appearing, tell the accountable person for the system. A pattern of overrides is information the system’s owner needs.',
      ] },
    ],
    quiz: [
      { q: 'A held decline looks wrong because a payslip arrived after the system ran. What do you do?', options: ['Approve the decline', 'Override it, choosing "Information the system did not have"', 'Ignore it until it expires', 'Ask the customer to reapply'], answer: 1, why: 'The system lacked information; that is a sound override, recorded with its reason.' },
      { q: 'You have approved every held decision for three months. Is that a problem?', options: ['No, the system is good', 'Possibly: it may mean decisions are not really being reviewed', 'No, overrides are bad', 'Only if a customer complains'], answer: 1, why: 'A zero override rate across real volume is questioned in an assessment.' },
      { q: 'Who sees the reason you give for an override?', options: ['Nobody', 'It is recorded with your name and can be reviewed', 'Only the customer', 'Only IT'], answer: 1, why: 'Overrides are part of the accountability record.' },
      { q: 'The same error keeps causing overrides. What next?', options: ['Keep overriding', 'Tell the accountable person for the system', 'Stop reviewing', 'Turn the system off yourself'], answer: 1, why: 'Patterns go to the system’s owner so the cause can be fixed.' },
    ],
  },
];

export const MODULE_BY_KEY: Record<string, TrainingModule> = Object.fromEntries(MODULES.map((m) => [m.key, m]));

/** Defaults until an organisation chooses: everyone takes the three general modules every 12 months. */
export const DEFAULT_REQUIRED = ['security-basics', 'popia-essentials', 'ai-at-work'];

export function scoreQuiz(m: TrainingModule, answers: unknown): { correct: number; total: number; passed: boolean; score: number } {
  const a = Array.isArray(answers) ? answers : [];
  const correct = m.quiz.reduce((n, q, i) => n + (a[i] === q.answer ? 1 : 0), 0);
  const score = Math.round((correct / m.quiz.length) * 100);
  return { correct, total: m.quiz.length, passed: correct / m.quiz.length >= PASS_MARK, score };
}

/** Whether a completion is still current. */
export const isCurrent = (completedAt: Date | string, everyMonths: number, now = Date.now()) => {
  const d = new Date(completedAt);
  d.setUTCMonth(d.getUTCMonth() + everyMonths);
  return d.getTime() > now;
};
