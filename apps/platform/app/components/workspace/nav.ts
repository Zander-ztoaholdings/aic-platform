import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Boxes, Activity, Sparkles,
  ShieldCheck, AlertTriangle, Siren, FileCheck,
  Award, MessageSquare,
  Building2, Users, Key, GraduationCap,
  ListChecks, ClipboardCheck, FileSearch, BadgeCheck,
  FileBarChart, UserCog, Lock, Target, LineChart,
} from 'lucide-react';
import { canManageTeamAndKeys } from '@/lib/roles';
import { staffCan, canUseHq, type WorkspaceUser } from '@/lib/workspace';

/**
 * Every navigation item in both workspaces, and who may see each one.
 *
 * One file, so the question "what can an ORG_USER reach?" has one answer. The
 * old client sidebar, the old staff sidebar and an unused capability-based
 * getNavigation() each had their own list, and they disagreed: the staff one
 * linked to /leads and /organizations, which do not exist — the pages live
 * under /admin.
 *
 * Visibility here is a courtesy, not a control. It hides what a role cannot
 * use; the layouts in app/(modules) and every API route still decide.
 */

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
  badge?: string;
  visible?: (user: WorkspaceUser) => boolean;
}

export interface NavGroup {
  key: string;
  label: string;
  summary: string;
  items: NavItem[];
}

// ── Client workspace ──────────────────────────────────────────────────────
//
// Three menus, in the order a client meets them: what they run, what the
// standard asks of it, and where their assessment stands. Account matters
// (profile, team, keys) sit in the person menu, top right, where every SaaS
// product people already use puts them — they are not a destination anyone
// navigates to in the course of their work.

export const CLIENT_NAV: NavGroup[] = [
  {
    key: 'overview',
    label: 'AI Overview',
    summary: 'What you run, what it decided, and who answered for it.',
    items: [
      { label: 'Continuity Record', href: '/dashboard', icon: LayoutDashboard, description: 'The standing record of your AI estate and every change to it.' },
      { label: 'AI Estate', href: '/overview', icon: Boxes, description: 'Each system, its purpose, and the person accountable for it.' },
      { label: 'Decision Log', href: '/pulse', icon: Activity, description: 'Decisions recorded, the overrides, and who made them.' },
      { label: 'Register Drafter', href: '/register-drafter', icon: Sparkles, badge: 'Soon', description: 'A draft AI register built from what you have declared.' },
    ],
  },
  {
    key: 'compliance',
    label: 'Compliance Tracking',
    summary: 'The requirements that apply to you, and the evidence against each.',
    items: [
      { label: 'Evidence Vault', href: '/evidence', icon: ShieldCheck, description: 'Requirements for your Division and the evidence you have filed.' },
      { label: 'Assessor Findings', href: '/findings', icon: AlertTriangle, description: 'What the assessor raised, and your corrective actions.' },
      { label: 'Incidents', href: '/incidents', icon: Siren, description: 'AI incidents reported, and how each was resolved.' },
      { label: 'Reports', href: '/reports', icon: FileCheck, description: 'Reports generated from your record.' },
    ],
  },
  {
    key: 'certification',
    label: 'AIC Certification',
    summary: 'Where your assessment stands against the AIC standard.',
    items: [
      { label: 'AIC Aware', href: '/aware', icon: BadgeCheck, description: 'Declare your AI awareness and hold a verifiable badge.' },
      { label: 'My Certificate', href: '/certificate', icon: Award, description: 'Your current status, and what stands between you and the next.' },
      { label: 'Correspondence', href: '/correspondence', icon: MessageSquare, description: 'Messages with your assessor, on the record.' },
    ],
  },
];

export const CLIENT_ACCOUNT: NavItem[] = [
  { label: 'Organisation profile', href: '/organisation', icon: Building2, description: 'Your organisation’s details.' },
  { label: 'Team', href: '/settings', icon: Users, description: 'Invite and manage people.', visible: (u) => canManageTeamAndKeys(u.role) },
  { label: 'API & access keys', href: '/settings/keys', icon: Key, description: 'Keys for systems that record decisions.', visible: (u) => canManageTeamAndKeys(u.role) },
  { label: 'Practitioner (CAAP)', href: '/practitioner', icon: GraduationCap, description: 'Your professional record.' },
];

// ── Staff workspace ───────────────────────────────────────────────────────
//
// Split the way the separation of duties in lib/capabilities.ts splits:
// evaluation work an auditor does, the register a super-admin decides on, and
// AIC's own administration. /admin/leaderboard and /admin/workspace are not
// listed — the index is parked, and the workspace page's purpose is unclear.
// Both still exist behind the gate.

export const STAFF_NAV: NavGroup[] = [
  {
    key: 'assessments',
    label: 'Assessments',
    summary: 'Evaluation work in progress across client files.',
    items: [
      { label: 'Review queue', href: '/admin/queue', icon: ListChecks, description: 'Submitted documents waiting for review.', visible: (u) => staffCan(u, 'conduct_assessment') },
      { label: 'Audits', href: '/admin/audits', icon: ClipboardCheck, description: 'Scheduled and completed audits.', visible: (u) => staffCan(u, 'conduct_assessment') },
      { label: 'Applications', href: '/admin/applications', icon: FileSearch, description: 'Organisations applying for assessment.', visible: (u) => staffCan(u, 'conduct_assessment') },
      { label: 'Verification', href: '/admin/verification', icon: BadgeCheck, description: 'Evidence and identity verification.', visible: (u) => staffCan(u, 'conduct_assessment') },
    ],
  },
  {
    key: 'register',
    label: 'Register',
    summary: 'Client organisations, certificates and reports.',
    items: [
      { label: 'Organisations', href: '/admin/organizations', icon: Building2, description: 'The client files assigned to you.', visible: (u) => staffCan(u, 'view_all_orgs') },
      { label: 'Certifications', href: '/admin/certifications', icon: Award, description: 'Issued certificates and their lifecycle.', visible: (u) => staffCan(u, 'conduct_assessment') },
      { label: 'Reports', href: '/admin/reports', icon: FileBarChart, description: 'Assessment reports across the register.', visible: (u) => staffCan(u, 'conduct_assessment') },
      { label: 'Practitioners', href: '/admin/practitioner', icon: GraduationCap, description: 'CAAP practitioner records.', visible: (u) => staffCan(u, 'conduct_assessment') },
    ],
  },
  {
    key: 'administration',
    label: 'Administration',
    summary: 'People, permissions, and AIC’s own business.',
    items: [
      { label: 'Users', href: '/admin/users', icon: UserCog, description: 'Accounts across every organisation.', visible: (u) => staffCan(u, 'manage_users') },
      { label: 'Permissions', href: '/admin/permissions', icon: Lock, description: 'Roles and what each may do.', visible: (u) => staffCan(u, 'manage_roles') },
      { label: 'Leads', href: '/admin/leads', icon: Target, description: 'The commercial pipeline.', visible: (u) => staffCan(u, 'access_hq') },
      { label: 'HQ', href: '/hq/governance', icon: LineChart, description: 'Revenue, people, content and company governance.', visible: (u) => canUseHq(u) },
    ],
  },
];

export function visibleItems(items: NavItem[], user: WorkspaceUser): NavItem[] {
  return items.filter((i) => !i.visible || i.visible(user));
}

/** Groups with their hidden items removed, and any group left empty dropped. */
export function visibleGroups(groups: NavGroup[], user: WorkspaceUser): NavGroup[] {
  return groups
    .map((g) => ({ ...g, items: visibleItems(g.items, user) }))
    .filter((g) => g.items.length > 0);
}
