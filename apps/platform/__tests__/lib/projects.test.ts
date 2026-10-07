// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { cleanProject, cleanTask } from '@/lib/projects-input';

describe('projects', () => {
  it('needs a name to create, and checks status and dates', () => {
    expect('error' in cleanProject({}, true)).toBe(true);
    expect(cleanProject({ name: ' Credit model v4 ', dueDate: '' }, true)).toEqual({ value: { name: 'Credit model v4', dueDate: null } });
    expect('error' in cleanProject({ status: 'archived' })).toBe(true);
    expect('error' in cleanProject({ dueDate: '7 Oct' })).toBe(true);
  });
  it('edits only the fields sent', () => {
    expect(cleanProject({ status: 'paused' })).toEqual({ value: { status: 'paused' } });
  });
  it('checks tasks', () => {
    expect('error' in cleanTask({ title: 'x' }, true)).toBe(true);
    expect(cleanTask({ title: 'Map evidence to A.6.2', assigneeId: '', frameworkKey: 'iso42001' }, true)).toEqual({ value: { title: 'Map evidence to A.6.2', assigneeId: null, frameworkKey: 'iso42001' } });
    expect('error' in cleanTask({ status: 'blocked' })).toBe(true);
  });
});
