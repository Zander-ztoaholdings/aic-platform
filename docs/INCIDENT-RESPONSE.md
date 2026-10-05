# Incident response

Use this when something has gone wrong with security: a leaked key, a suspected breach, data that someone should not have seen, a compromised account, or a backup or restore failure that leaves data at risk.

Keep it short and do it in order. Write down the time and what you did as you go. That log is evidence later.

## 1. Contain (first hour)

| What happened | What to do |
|---|---|
| **A secret leaked** (an environment variable, an API key, a database password, the GitHub App private key, `ENCRYPTION_KEY`) | Rotate it now, then redeploy. For `ENCRYPTION_KEY`, follow "Rotating the encryption key" in `docs/OPERATIONS.md`. |
| **A staff account is compromised** | In Admin → People, deactivate it with the reason "Security incident". This signs the person out on their next request, within 60 seconds. |
| **A client account is compromised** | Deactivate it the same way and tell the client's organisation admin. |
| **A client's provider key may be exposed** | Disconnect that provider on the client's behalf. This deletes the stored key. Then ask the client to revoke the key with the provider. |
| **The server itself is suspect** | Take a fresh backup (`scripts/backup/backup.sh`) before changing anything, so the state can be examined later. |

## 2. Assess (first day)

1. What data was involved? Whose? How many people and organisations?
2. Was personal information accessed or acquired by someone who should not have it? If yes, POPIA section 22 applies.
3. Is it still happening?

## 3. Notify

- **Clients.** Tell every affected organisation without undue delay, and within 72 hours of becoming aware. That is the commitment in the data processing agreement. Say:
  - what happened;
  - what information is involved;
  - what AIC has done; and
  - what they should do, for example revoke a key.
- **The Information Regulator.** If AIC is the responsible party for the affected information (its own users, assessor records, certification data), notify the Information Regulator as soon as reasonably possible (POPIA section 22). Use the Regulator's form at inforegulator.org.za. Where AIC is the operator, the client notifies, and AIC helps.
- **The people affected.** These are the data subjects: the individuals whose information was involved. Where AIC is the responsible party, notify them in writing as section 22(4) describes, unless the Regulator directs otherwise.
- **Insurers.** If AIC holds cyber or professional indemnity cover, check the policy's notification deadline and meet it.

## 4. Recover and learn

- Restore from backup if needed, using `scripts/backup/restore-test.sh` first to confirm the backup is good.
- Within two weeks, write a one-page note covering:
  - what happened;
  - why;
  - what changed so it cannot happen the same way again.

  Keep it with this file.

## Contacts

| Role | Who |
|---|---|
| Information Officer | Zander Wilken, zander@ztoaholdings.com |
| Deputy | [name] |
| Hosting support | Hostinger, via hPanel |
| Information Regulator | inforegulator.org.za, POPIAComplaints@inforegulator.org.za |
