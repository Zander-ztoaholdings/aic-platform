-- The continuity record: an append-only, hash-chained account of what AI an
-- organisation was running, who was accountable for it, and what changed.
--
-- WHY THIS EXISTS.
--
-- AIC has no accreditation. A certificate it issues is therefore worth exactly
-- what AIC's own eighteen-month-old reputation is worth, which is not yet
-- enough to sell on. The record is a different asset. If AIC has kept an
-- unbroken account from the day a client signed up, then when a regulator, an
-- insurer or a plaintiff asks "what were you running and when did you know",
-- the client has an answer that cannot be reconstructed after the fact. That
-- answer has standing whether or not the certificate ever does — and if AIC is
-- accredited later, the clients holding a multi-year record convert instantly.
--
-- So this table is not telemetry and it is not an activity feed. It is the
-- product.
--
-- WHY IT IS A SECOND CHAIN, NOT audit_ledger.
--
-- audit_ledger chains hashes of content that lives in other tables. That is
-- fine for proving an internal record was not altered, because the verifier is
-- inside the system and can see both halves. It is useless to a third party
-- holding an export, who has the hash and not the thing it hashes. The whole
-- value here is that the record can be handed to someone outside AIC and
-- checked, so the event content and its chain live in the same row. One
-- hashing implementation is shared (HashChainService.computeHash); two chains
-- exist deliberately because they answer different questions.
--
-- WHY IT IS HAND-WRITTEN. Same reason as 001-003: `drizzle-kit generate`
-- stops on pre-existing drift in this schema and will not emit a clean file.
--
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS estate_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Per-organisation, 1-based, gapless. A gap in the sequence is itself
  -- evidence of tampering, which a timestamp ordering alone cannot show.
  seq            bigint NOT NULL,

  observed_at    timestamptz NOT NULL DEFAULT now(),

  -- AI_SYSTEM | ACCOUNTABLE_PERSON | EVIDENCE | REQUIREMENT | FINDING |
  -- UNDECLARED_SYSTEM | CERTIFICATE
  entity_type    varchar(40) NOT NULL,

  -- Stable identity within its type: a uuid where one exists, otherwise the
  -- declared name. Undeclared systems have no uuid by definition, which is the
  -- entire point of them.
  entity_key     varchar(255) NOT NULL,

  -- The human-readable name AS IT WAS at the time of the event. Deliberately
  -- denormalised: if the system is later renamed, this row must still read the
  -- way it read when it was written, or the record is retroactively edited by
  -- a join.
  entity_label   varchar(255) NOT NULL,

  -- DECLARED | CHANGED | WITHDRAWN | OBSERVED
  --   OBSERVED is reserved for things AIC noticed rather than things the
  --   organisation told it — an undeclared system appearing in the decision
  --   log. The distinction matters: one is a declaration and the other is a
  --   finding, and conflating them would let AIC's own observation masquerade
  --   as the client's statement.
  change_type    varchar(30) NOT NULL,

  field          varchar(80),
  previous_value text,
  new_value      text,

  -- Who. 'AIC continuity observer' where no human acted; never left blank,
  -- because an unattributed change in an accountability record is worse than
  -- no record.
  actor_label    varchar(255) NOT NULL,
  actor_user_id  uuid REFERENCES users(id) ON DELETE SET NULL,

  previous_hash  varchar(64),
  hash           varchar(64) NOT NULL,

  created_at     timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT estate_events_org_seq_unique UNIQUE (org_id, seq)
);

CREATE INDEX IF NOT EXISTS estate_events_org_seq_idx      ON estate_events(org_id, seq DESC);
CREATE INDEX IF NOT EXISTS estate_events_org_observed_idx ON estate_events(org_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS estate_events_entity_idx       ON estate_events(org_id, entity_type, entity_key);

-- Append-only, enforced by the database rather than by convention.
--
-- A record that the application layer merely promises not to edit is a record
-- an attacker with a database connection can edit, and an auditor is entitled
-- to assume the weakest link. This is also why corrections are additive: to
-- fix a wrong event you append a correcting one, and both stay visible.
CREATE OR REPLACE FUNCTION estate_events_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'estate_events is append-only: % is not permitted. Append a correcting event instead.', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS estate_events_no_update ON estate_events;
CREATE TRIGGER estate_events_no_update
  BEFORE UPDATE OR DELETE ON estate_events
  FOR EACH ROW EXECUTE FUNCTION estate_events_append_only();

-- ─────────────────────────────────────────────────────────────────────────
-- The diff cursor.
--
-- NOT evidence, and deliberately not named as though it were. This holds the
-- last observed state purely so the next observation has something to compare
-- against; it is overwritten every run. The events are the record. If this
-- table were lost entirely the record would survive intact, which is the test
-- of whether something is evidence or scaffolding.

CREATE TABLE IF NOT EXISTS estate_snapshots (
  org_id      uuid PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  taken_at    timestamptz NOT NULL DEFAULT now(),
  -- The seq of the last event written from this snapshot, so a run that
  -- crashed between writing events and updating the cursor can be detected.
  event_seq   bigint NOT NULL DEFAULT 0,
  state       jsonb NOT NULL
);

-- ─────────────────────────────────────────────────────────────────────────
ALTER TABLE estate_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE estate_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS estate_events_isolation_policy ON estate_events;
CREATE POLICY estate_events_isolation_policy ON estate_events
USING       (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid)
WITH CHECK  (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid);

DROP POLICY IF EXISTS estate_snapshots_isolation_policy ON estate_snapshots;
CREATE POLICY estate_snapshots_isolation_policy ON estate_snapshots
USING       (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid)
WITH CHECK  (org_id = NULLIF(current_setting('app.current_org_id', TRUE), '')::uuid);
