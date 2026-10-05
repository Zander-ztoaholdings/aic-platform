/**
 * Re-encrypt every stored secret under the current key.
 *
 * Run after setting ENCRYPTION_KEYS (new key first) or after moving from a
 * passphrase to a proper ENCRYPTION_KEY. It reads each value with whatever
 * key wrote it, writes it back under the current key, and is safe to run
 * again: values already under the current key are skipped. MFA secrets that
 * were stored in plain text before Oct 2026 are encrypted for the first time.
 *
 *   DATABASE_URL=… ENCRYPTION_KEYS="2026b:<new>,k1:<old>" npx tsx scripts/reencrypt.ts
 *   add --dry-run to count without writing.
 */
import { Pool } from 'pg';
import { EncryptionService } from '../packages/db/src/services/encryption';

const dry = process.argv.includes('--dry-run');
const TARGETS: { table: string; id: string; columns: string[]; plainAllowed?: boolean }[] = [
  { table: 'integrations', id: 'id', columns: ['secret_ciphertext'] },
  { table: 'exam_questions', id: 'id', columns: ['question_encrypted', 'options_encrypted', 'correct_answer_encrypted', 'explanation_encrypted'] },
  { table: 'users', id: 'id', columns: ['two_factor_secret'], plainAllowed: true },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let changed = 0;
  let failed = 0;
  for (const t of TARGETS) {
    const exists = await pool.query(`select 1 from information_schema.tables where table_name = $1`, [t.table]);
    if (!exists.rowCount) continue;
    for (const col of t.columns) {
      const rows = await pool.query(`select ${t.id} as id, ${col} as v from ${t.table} where ${col} is not null`);
      for (const r of rows.rows as { id: string; v: string }[]) {
        if (EncryptionService.isCurrent(r.v)) continue;
        const plain = t.plainAllowed ? EncryptionService.decryptOrPlain(r.v) : EncryptionService.decrypt(r.v);
        if (!plain || plain === EncryptionService.UNREADABLE) {
          failed++;
          console.error(`could not read ${t.table}.${col} for ${r.id}; left as is`);
          continue;
        }
        if (!dry) await pool.query(`update ${t.table} set ${col} = $1 where ${t.id} = $2`, [EncryptionService.encrypt(plain), r.id]);
        changed++;
      }
    }
  }
  console.log(`${dry ? 'would re-encrypt' : 're-encrypted'} ${changed} value(s); ${failed} could not be read.`);
  await pool.end();
  process.exit(failed ? 1 : 0);
}
main();
