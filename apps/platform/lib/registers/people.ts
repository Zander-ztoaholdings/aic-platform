/** People list rules: validation and CSV import. Pure; tested. */
export type PersonInput = { name: string; email: string | null; jobTitle: string | null; department: string | null; startDate: string | null; endDate: string | null; source: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, n: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : null);

export function cleanPerson(b: Record<string, unknown>): { error: string } | { value: PersonInput } {
  const name = str(b.name, 200);
  if (!name) return { error: 'Give the person a name.' };
  const email = str(b.email, 255);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: `${email} is not an email address.` };
  const startDate = str(b.startDate, 10), endDate = str(b.endDate, 10);
  if ((startDate && !DATE.test(startDate)) || (endDate && !DATE.test(endDate))) return { error: 'Dates must be YYYY-MM-DD.' };
  if (startDate && endDate && endDate < startDate) return { error: 'The leaving date is before the start date.' };
  return { value: { name, email: email?.toLowerCase() ?? null, jobTitle: str(b.jobTitle, 200), department: str(b.department, 120), startDate, endDate, source: 'manual' } };
}

/** A CSV with a header row; columns matched by name (name, email, job title, department, start date, end date). */
export function parsePeopleCsv(text: string): { error: string } | { people: PersonInput[]; skipped: number } {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
  if (lines.length < 2) return { error: 'Paste a header row and at least one person.' };
  const split = (l: string) => {
    const out: string[] = []; let cur = ''; let q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
      else if (ch === '"') q = true; else if (ch === ',' || ch === '\t' || ch === ';') { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur); return out.map((x) => x.trim());
  };
  const head = split(lines[0]).map((h) => h.toLowerCase().replace(/[^a-z]/g, ''));
  const col = (...names: string[]) => head.findIndex((h) => names.includes(h));
  const idx = { name: col('name', 'fullname', 'employee', 'employeename'), email: col('email', 'workemail', 'emailaddress'), job: col('jobtitle', 'title', 'role', 'position'), dept: col('department', 'team'), start: col('startdate', 'start', 'hiredate', 'joined'), end: col('enddate', 'end', 'terminationdate', 'leavingdate', 'left') };
  if (idx.name < 0) return { error: 'The header row needs a "name" column.' };
  const people: PersonInput[] = []; let skipped = 0;
  for (const line of lines.slice(1, 2001)) {
    const c = split(line);
    const v = cleanPerson({ name: c[idx.name], email: idx.email >= 0 ? c[idx.email] : null, jobTitle: idx.job >= 0 ? c[idx.job] : null, department: idx.dept >= 0 ? c[idx.dept] : null, startDate: idx.start >= 0 ? c[idx.start] : null, endDate: idx.end >= 0 ? c[idx.end] : null });
    if ('error' in v) skipped++; else people.push({ ...v.value, source: 'import' });
  }
  return { people, skipped };
}
