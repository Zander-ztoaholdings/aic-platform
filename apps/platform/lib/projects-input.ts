/** Pure checks on project and task input (lib/projects), kept apart so they import nothing that needs a server. */

export const PROJECT_STATUS = ['active', 'paused', 'done'] as const;
export const MEMBER_ROLES = ['lead', 'contributor', 'reviewer'] as const;
export const TASK_STATUS = ['todo', 'doing', 'done'] as const;
export type ProjectStatus = (typeof PROJECT_STATUS)[number];
export type MemberRole = (typeof MEMBER_ROLES)[number];
export type TaskStatus = (typeof TASK_STATUS)[number];

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

/** Pure: a project's editable fields from a request body, each only if present. */
export function cleanProject(b: Record<string, unknown>, creating = false): { value: Partial<{ name: string; description: string | null; status: ProjectStatus; leadId: string | null; dueDate: string | null }> } | { error: string } {
  const out: Record<string, unknown> = {};
  if (creating || 'name' in b) {
    const name = typeof b.name === 'string' ? b.name.trim() : '';
    if (name.length < 2 || name.length > 160) return { error: 'Give the project a name of 2 to 160 characters.' };
    out.name = name;
  }
  if ('description' in b) out.description = typeof b.description === 'string' && b.description.trim() ? b.description.trim().slice(0, 4000) : null;
  if ('status' in b) {
    if (!PROJECT_STATUS.includes(b.status as ProjectStatus)) return { error: 'Status is active, paused or done.' };
    out.status = b.status;
  }
  if ('leadId' in b) {
    if (b.leadId !== null && !isId(b.leadId)) return { error: 'Choose the lead from your team.' };
    out.leadId = b.leadId;
  }
  if ('dueDate' in b) {
    if (b.dueDate !== null && b.dueDate !== '' && !isDate(b.dueDate)) return { error: 'The due date is not a date.' };
    out.dueDate = b.dueDate || null;
  }
  return { value: out };
}

/** Pure: a task's editable fields. */
export function cleanTask(b: Record<string, unknown>, creating = false): { value: Partial<{ title: string; detail: string | null; assigneeId: string | null; dueDate: string | null; status: TaskStatus; frameworkKey: string | null }> } | { error: string } {
  const out: Record<string, unknown> = {};
  if (creating || 'title' in b) {
    const title = typeof b.title === 'string' ? b.title.trim() : '';
    if (title.length < 2 || title.length > 300) return { error: 'Say what needs doing, in 2 to 300 characters.' };
    out.title = title;
  }
  if ('detail' in b) out.detail = typeof b.detail === 'string' && b.detail.trim() ? b.detail.trim().slice(0, 4000) : null;
  if ('assigneeId' in b) {
    if (b.assigneeId !== null && b.assigneeId !== '' && !isId(b.assigneeId)) return { error: 'Choose who it is for from the project.' };
    out.assigneeId = b.assigneeId || null;
  }
  if ('dueDate' in b) {
    if (b.dueDate !== null && b.dueDate !== '' && !isDate(b.dueDate)) return { error: 'The due date is not a date.' };
    out.dueDate = b.dueDate || null;
  }
  if ('status' in b) {
    if (!TASK_STATUS.includes(b.status as TaskStatus)) return { error: 'Status is to do, doing or done.' };
    out.status = b.status;
  }
  if ('frameworkKey' in b) out.frameworkKey = typeof b.frameworkKey === 'string' && b.frameworkKey ? b.frameworkKey.slice(0, 80) : null;
  return { value: out };
}

