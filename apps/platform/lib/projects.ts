/**
 * Projects: compliance work split the way the organisation actually works.
 *
 * Not every piece of work answers to every framework. A payments rebuild may
 * need PCI DSS and POPIA; an HR screening model needs POPIA section 71 and
 * ISO/IEC 42001. A project names the people on it (lead, contributors,
 * reviewers), switches on only the frameworks it must meet, scopes the AI
 * systems it touches, and keeps its own task list.
 *
 * Evidence is never split by project: a control met once is met everywhere it
 * applies. A project shows the organisation's coverage of each of its
 * frameworks, so the same truth is read through a narrower window.
 */
import {
  getTenantDb, projects, projectMembers, projectFrameworks, projectSystems, projectTasks, users, aiSystems,
  eq, and, asc, desc, inArray,
} from '@aic/db';
import { computeControls } from './controls-data';
import { coverage } from './controls';

import { MEMBER_ROLES, type MemberRole, type ProjectStatus, type TaskStatus } from './projects-input';
export * from './projects-input';

/** Who can be put on a project: the organisation's active members. */
export async function orgMembers(orgId: string) {
  const rows = await getTenantDb(orgId).query((tx) =>
    tx.select({ id: users.id, name: users.name, email: users.email, isActive: users.isActive }).from(users).where(eq(users.orgId, orgId)).orderBy(asc(users.name)));
  return rows.filter((u) => u.isActive !== false && !u.email.endsWith('@removed.invalid')).map((u) => ({ id: u.id, name: u.name || u.email, email: u.email }));
}

/** Every project, with its counts, for the list page. */
export async function listProjects(orgId: string) {
  return getTenantDb(orgId).query(async (tx) => {
    const ps = await tx.select().from(projects).where(eq(projects.orgId, orgId)).orderBy(desc(projects.updatedAt));
    if (!ps.length) return [];
    const ids = ps.map((p) => p.id);
    const [members, fws, tasks, systems] = await Promise.all([
      tx.select({ projectId: projectMembers.projectId, userId: projectMembers.userId }).from(projectMembers).where(inArray(projectMembers.projectId, ids)),
      tx.select({ projectId: projectFrameworks.projectId, key: projectFrameworks.frameworkKey }).from(projectFrameworks).where(inArray(projectFrameworks.projectId, ids)),
      tx.select({ projectId: projectTasks.projectId, status: projectTasks.status, dueDate: projectTasks.dueDate }).from(projectTasks).where(inArray(projectTasks.projectId, ids)),
      tx.select({ projectId: projectSystems.projectId }).from(projectSystems).where(inArray(projectSystems.projectId, ids)),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    return ps.map((p) => {
      const t = tasks.filter((x) => x.projectId === p.id);
      return {
        ...p,
        members: members.filter((m) => m.projectId === p.id).length,
        frameworks: fws.filter((f) => f.projectId === p.id).map((f) => f.key),
        systems: systems.filter((s) => s.projectId === p.id).length,
        tasks: { total: t.length, done: t.filter((x) => x.status === 'done').length, overdue: t.filter((x) => x.status !== 'done' && x.dueDate && x.dueDate < today).length },
      };
    });
  });
}

/** One project, whole: people, frameworks with coverage, systems and tasks. */
export async function getProject(orgId: string, id: string) {
  const db = getTenantDb(orgId);
  const data = await db.query(async (tx) => {
    const [p] = await tx.select().from(projects).where(and(eq(projects.id, id), eq(projects.orgId, orgId))).limit(1);
    if (!p) return null;
    const [members, fws, systems, tasks] = await Promise.all([
      tx.select({ userId: projectMembers.userId, role: projectMembers.role }).from(projectMembers).where(eq(projectMembers.projectId, id)),
      tx.select({ key: projectFrameworks.frameworkKey }).from(projectFrameworks).where(eq(projectFrameworks.projectId, id)),
      tx.select({ systemId: projectSystems.systemId }).from(projectSystems).where(eq(projectSystems.projectId, id)),
      tx.select().from(projectTasks).where(eq(projectTasks.projectId, id)).orderBy(asc(projectTasks.status), asc(projectTasks.dueDate), asc(projectTasks.createdAt)),
    ]);
    const allSystems = await tx.select({ id: aiSystems.id, name: aiSystems.name, isActive: aiSystems.isActive }).from(aiSystems).where(eq(aiSystems.orgId, orgId)).orderBy(asc(aiSystems.name));
    return { p, members, fws: fws.map((f) => f.key), systems: systems.map((s) => s.systemId), tasks, allSystems: allSystems.filter((s) => s.isActive !== false) };
  });
  if (!data) return null;
  const [people, controls] = await Promise.all([orgMembers(orgId), computeControls(orgId)]);
  const frameworks = controls.frameworks.map((f) => ({
    key: f.key, name: f.name, note: f.note,
    on: data.fws.includes(f.key),
    coverage: coverage(controls.controls.filter((c) => c.framework === f.key)),
  }));
  return {
    project: data.p,
    members: data.members.map((m) => ({ ...m, ...(people.find((u) => u.id === m.userId) ?? { id: m.userId, name: 'Former member', email: '' }) })),
    people,
    frameworks,
    // A framework switched on here but no longer tracked by the organisation is still listed, so nothing silently disappears.
    untracked: data.fws.filter((k) => !controls.frameworks.some((f) => f.key === k)),
    systems: data.allSystems.map((s) => ({ id: s.id, name: s.name, on: data.systems.includes(s.id) })),
    tasks: data.tasks,
  };
}

export async function createProject(orgId: string, userId: string, v: { name: string; description?: string | null; status?: ProjectStatus; leadId?: string | null; dueDate?: string | null }) {
  return getTenantDb(orgId).query(async (tx) => {
    const [p] = await tx.insert(projects).values({ orgId, name: v.name, description: v.description ?? null, status: v.status ?? 'active', leadId: v.leadId ?? userId, dueDate: v.dueDate ?? null, createdBy: userId }).returning({ id: projects.id });
    await tx.insert(projectMembers).values({ projectId: p.id, orgId, userId: v.leadId ?? userId, role: 'lead' }).onConflictDoNothing();
    return p.id;
  });
}

/** Replaces the project's people, frameworks or systems where given; edits the rest. Members must belong to the organisation. */
export async function updateProject(orgId: string, id: string, edit: Record<string, unknown>, fields: Record<string, unknown>) {
  const people = 'members' in edit ? new Set((await orgMembers(orgId)).map((u) => u.id)) : null;
  const systemIds = 'systems' in edit ? new Set((await getTenantDb(orgId).query((tx) => tx.select({ id: aiSystems.id }).from(aiSystems).where(eq(aiSystems.orgId, orgId)))).map((s) => s.id)) : null;
  return getTenantDb(orgId).query(async (tx) => {
    const [p] = await tx.select({ id: projects.id }).from(projects).where(and(eq(projects.id, id), eq(projects.orgId, orgId))).limit(1);
    if (!p) return false;
    await tx.update(projects).set({ ...fields, updatedAt: new Date() }).where(eq(projects.id, id));
    if (Array.isArray(edit.frameworks)) {
      const keys = [...new Set(edit.frameworks.filter((k): k is string => typeof k === 'string' && k.length <= 80))].slice(0, 60);
      await tx.delete(projectFrameworks).where(eq(projectFrameworks.projectId, id));
      if (keys.length) await tx.insert(projectFrameworks).values(keys.map((k) => ({ projectId: id, orgId, frameworkKey: k })));
    }
    if (Array.isArray(edit.systems) && systemIds) {
      const ids = [...new Set(edit.systems.filter((s): s is string => typeof s === 'string' && systemIds.has(s)))];
      await tx.delete(projectSystems).where(eq(projectSystems.projectId, id));
      if (ids.length) await tx.insert(projectSystems).values(ids.map((s) => ({ projectId: id, orgId, systemId: s })));
    }
    if (Array.isArray(edit.members) && people) {
      const list = (edit.members as { userId?: unknown; role?: unknown }[])
        .filter((m) => typeof m?.userId === 'string' && people.has(m.userId) && MEMBER_ROLES.includes(m.role as MemberRole))
        .map((m) => ({ projectId: id, orgId, userId: m.userId as string, role: m.role as MemberRole }));
      const unique = [...new Map(list.map((m) => [m.userId, m])).values()];
      await tx.delete(projectMembers).where(eq(projectMembers.projectId, id));
      if (unique.length) await tx.insert(projectMembers).values(unique);
    }
    return true;
  });
}

export async function deleteProject(orgId: string, id: string) {
  const r = await getTenantDb(orgId).query((tx) => tx.delete(projects).where(and(eq(projects.id, id), eq(projects.orgId, orgId))).returning({ id: projects.id }));
  return r.length > 0;
}

export async function addTask(orgId: string, projectId: string, userId: string, v: Record<string, unknown>) {
  return getTenantDb(orgId).query(async (tx) => {
    const [p] = await tx.select({ id: projects.id }).from(projects).where(and(eq(projects.id, projectId), eq(projects.orgId, orgId))).limit(1);
    if (!p) return null;
    const [t] = await tx.insert(projectTasks).values({ projectId, orgId, createdBy: userId, title: v.title as string, detail: (v.detail as string) ?? null, assigneeId: (v.assigneeId as string) ?? null, dueDate: (v.dueDate as string) ?? null, status: (v.status as TaskStatus) ?? 'todo', frameworkKey: (v.frameworkKey as string) ?? null }).returning({ id: projectTasks.id });
    await tx.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));
    return t.id;
  });
}

export async function updateTask(orgId: string, projectId: string, taskId: string, v: Record<string, unknown>) {
  const set: Record<string, unknown> = { ...v };
  if (v.status === 'done') set.doneAt = new Date();
  else if (v.status) set.doneAt = null;
  return getTenantDb(orgId).query(async (tx) => {
    const r = await tx.update(projectTasks).set(set).where(and(eq(projectTasks.id, taskId), eq(projectTasks.projectId, projectId), eq(projectTasks.orgId, orgId))).returning({ id: projectTasks.id });
    if (r.length) await tx.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));
    return r.length > 0;
  });
}

export async function deleteTask(orgId: string, projectId: string, taskId: string) {
  const r = await getTenantDb(orgId).query((tx) => tx.delete(projectTasks).where(and(eq(projectTasks.id, taskId), eq(projectTasks.projectId, projectId), eq(projectTasks.orgId, orgId))).returning({ id: projectTasks.id }));
  return r.length > 0;
}
