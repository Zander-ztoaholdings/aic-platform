# Workspace design and access flow

The direction the platform's two workspaces are built to, and the rule for who
lands where. Read before adding a page or a navigation item.

## Who goes where

| Person | Lands on | May open | Cannot open |
| --- | --- | --- | --- |
| Org admin / org user | `/` (client workspace) | Client pages for their own organisation | `/admin`, `/hq` |
| AIC auditor | `/admin` (staff workspace) | Assessment and register pages their capabilities allow | `/hq`; client pages unless the account carries an organisation, and then read-only |
| AIC super admin (`isSuperAdmin`) | `/admin` | Everything | — |
| Signed in, no organisation, not staff | `/unauthorized` | Nothing | Everything |

Every sign-in — password or SSO — goes through `/start`, which decides on the
server from the session. A `?next=` deep link is honoured only if it is a path
on this site and the person may open it (`lib/workspace.ts`, tested in
`__tests__/lib/workspace.test.ts`).

Three layers, each independent of the others:

1. **Layout gates** — `app/(modules)/admin/layout.tsx` and
   `app/(modules)/hq/layout.tsx` refuse on the server before any staff UI is
   sent.
2. **Navigation** — `app/components/workspace/nav.ts` hides what a role cannot
   use. A courtesy, not a control.
3. **APIs** — `lib/rbac.ts` (staff capabilities) and `lib/guard.ts`
   (client writes) decide every request regardless of the other two.

Adding a page means adding it to `nav.ts` with a `visible` rule, and making
sure its API does its own check. Never rely on the menu hiding it.

## Layout

One top bar, grouped menus, full width for the work. Replaces a 256px dark
sidebar that listed every destination on every page.

- **Client workspace** (light): *AI Overview* · *Compliance Tracking* ·
  *AIC Certification*. Account pages — organisation profile, team, API keys,
  practitioner — live in the person menu, top right.
- **Staff workspace** (dark): *Assessments* · *Register* · *Administration*,
  mirroring the separation of duties in `lib/capabilities.ts`. Dark on purpose,
  so staff never mistake their console for a client's workspace.
- Each menu opens a panel: icon, name, one line saying what the page is for.
- Under the client bar, one status line: assessment stage and the four record
  figures. Real values or an em dash — never a placeholder, never a "live"
  indicator for a feed that does not exist.

### References

Pattern research used SaaSFrame, Refero, Mobbin and SaaS Shots. SaaSFrame's
flow search and Mobbin's screen library are behind paid accounts, so the
direction draws on what is openly browsable — chiefly the grouped mega-menu
(Square's is the clearest instance: menus opening labelled, described panels)
— and on the conventions the professional B2B tools in those libraries share:
Stripe, Linear, Vercel, Notion.

### Visual rules

- Canvas `#fbfcfd → #f3f5f8`; surfaces white; borders `rgba(10,23,40,.06)`.
- Navy `#0A1728` for text and primary actions; gold `#c9920a` only for the
  active marker, focus ring and progress. A touch, not a theme.
- Radius: 8px controls, 12px rows, 16px panels, 28px hero cards.
- Shadow: one soft, wide drop — `0 18px 48px -18px rgba(10,23,40,.22)`.
- Type: serif for the wordmark and page titles; sans at 12–13px for chrome.
- Motion: panels fade and scale from 95%; nothing animates that the person did
  not cause.

## Not done yet

- The three pages moved from `app/admin/` (organisations, permissions, queue)
  render without the staff shell.
- Client pages are gated client-side in `DashboardShell`; they want a server
  layout of their own once they move into a route group.
- Page interiors still carry the previous visual language; the shell is new,
  the pages inside it are not.
