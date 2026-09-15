import {
  getTenantDb,
  organizations,
  issuedCertifications,
  auditRequirements,
  auditDocuments,
  auditFindings,
  aiSystems,
  accountablePersons,
  decisionRecords,
  correctionRequests,
  llmUsageRecords,
  eq,
  and,
  desc,
  count,
  isNull,
  isNotNull,
  max,
  sum,
} from '@aic/db';

/**
 * The organisation's AI overview — one assembly, two audiences.
 *
 * The client sees this as their inventory and their gaps. The insurer sees a
 * narrower projection of the same object through the underwriting extract.
 * They are the same read for a reason: if the two ever disagreed, the client
 * would be managing one picture while the underwriter priced another, and
 * neither would know. One builder means a gap the client can see is the same
 * gap the insurer is told about.
 *
 * Nothing here is a score, a grade or a recommendation. Every field is a count,
 * a date, a name or a flag that can be traced to a row someone entered or an
 * assessor verified. The judgement stays with whoever is qualified to make it.
 */

export const DIVISION_NAMES: Record<number, string> = {
  1: 'Sovereign',
  2: 'Supervised',
  3: 'Reviewed',
  4: 'Monitored',
  5: 'Artificial',
};

export type Gap = {
  /** Stable key so the Gap Report and the UI agree on what a gap is. */
  code: string;
  severity: 'BLOCKING' | 'MATERIAL' | 'ADVISORY';
  title: string;
  /** What was observed. Never an instruction — AIC does not tell a client how
   *  to fix it, because designing the fix is consultancy. */
  detail: string;
  count?: number;
};

export type OrgOverview = Awaited<ReturnType<typeof buildOrgOverview>>;

/**
 * The gap rules, separated from the query that feeds them.
 *
 * These are the only part of this file that exercises judgement, so they are
 * the only part worth testing — and a rule buried inside a database callback
 * cannot be tested without a database. Pure in, pure out: the tests assert on
 * the rules, and a change to a rule fails a test rather than a demo.
 */
export type GapFacts = {
  accountablePersons: number;
  declaredSystems: number;
  undeclaredButDeciding: { name: string; decisions: number }[];
  // Same shape of problem as undeclaredButDeciding, different evidence
  // source: usage records that named a system on their own initiative
  // (attribution is optional, see llmUsageRecords) and that name is not on
  // the inventory. Left empty whenever an org's usage exports don't carry
  // system attribution at all - absence of attribution is not evidence of
  // an undeclared system, only a false attribution is.
  undeclaredButUsing: { name: string; provider: string }[];
  systemsWithoutPurpose: string[];
  overdueFindings: string[];
  evidenceRejected: number;
  requirementsNotStarted: number;
  decisions: number;
  overrides: number;
};

export function deriveGaps(f: GapFacts): Gap[] {
  const gaps: Gap[] = [];

  if (f.accountablePersons === 0) {
    gaps.push({
      code: 'HU-1-NO-ACCOUNTABLE-PERSON',
      severity: 'BLOCKING',
      title: 'No accountable person on record',
      detail:
        'No current accountable-person declaration exists for this organisation. ' +
        'Human accountability cannot be evidenced without one.',
    });
  }

  if (f.undeclaredButDeciding.length > 0) {
    gaps.push({
      code: 'HU-3-UNDECLARED-SYSTEM',
      severity: 'BLOCKING',
      title: 'Decisions logged by systems that are not on the inventory',
      detail:
        f.undeclaredButDeciding.map((u) => `${u.name} (${u.decisions})`).join(', ') +
        ' — each of these has recorded a decision but does not appear in the declared AI inventory.',
      count: f.undeclaredButDeciding.length,
    });
  }

  if (f.undeclaredButUsing.length > 0) {
    gaps.push({
      code: 'HU-3-UNDECLARED-USAGE',
      severity: 'BLOCKING',
      title: 'Provider usage attributed to systems that are not on the inventory',
      detail:
        f.undeclaredButUsing.map((u) => `${u.name} (${u.provider})`).join(', ') +
        ' — usage records name these as the system responsible, but none appears in the declared AI inventory.',
      count: f.undeclaredButUsing.length,
    });
  }

  if (f.declaredSystems === 0) {
    gaps.push({
      code: 'HU-3-EMPTY-INVENTORY',
      severity: 'BLOCKING',
      title: 'No AI systems declared',
      detail:
        'The inventory is empty. Completeness of the inventory is a declaration by the ' +
        'organisation; it cannot be inferred from what happens to be connected.',
    });
  }

  if (f.systemsWithoutPurpose.length > 0) {
    gaps.push({
      code: 'EX-1-NO-STATED-PURPOSE',
      severity: 'MATERIAL',
      title: 'Declared systems with no stated purpose',
      detail:
        f.systemsWithoutPurpose.join(', ') +
        ' — a system with no recorded purpose cannot be assessed for proportionality.',
      count: f.systemsWithoutPurpose.length,
    });
  }

  if (f.overdueFindings.length > 0) {
    gaps.push({
      code: 'FINDINGS-OVERDUE',
      severity: 'MATERIAL',
      title: 'Findings past their response date',
      detail: f.overdueFindings.join(', '),
      count: f.overdueFindings.length,
    });
  }

  if (f.evidenceRejected > 0) {
    gaps.push({
      code: 'EVIDENCE-REJECTED',
      severity: 'MATERIAL',
      title: 'Evidence rejected at verification',
      detail:
        'Submitted evidence did not pass verification and the requirement it covered remains unmet.',
      count: f.evidenceRejected,
    });
  }

  if (f.requirementsNotStarted > 0) {
    gaps.push({
      code: 'REQUIREMENTS-NOT-STARTED',
      severity: 'ADVISORY',
      title: 'Requirements with no evidence submitted',
      detail: 'These requirements are still pending against the published standard.',
      count: f.requirementsNotStarted,
    });
  }

  // A control that has never fired is not yet evidence that the control works.
  // Deliberately advisory, not material: a genuinely low override rate is a
  // legitimate state, and calling it a failing would be AIC deciding how the
  // organisation should run its own review process.
  if (f.decisions > 0 && f.overrides === 0) {
    gaps.push({
      code: 'HU-2-ZERO-OVERRIDES',
      severity: 'ADVISORY',
      title: 'No human override has ever been recorded',
      detail:
        `${f.decisions} decisions are logged and none was overridden. That may be correct, ` +
        'but a human-in-the-loop control that has never fired is not yet evidenced as working.',
    });
  }

  return gaps;
}

export async function buildOrgOverview(orgId: string) {
  const db = getTenantDb(orgId);

  return db.query(async (tx) => {
    const [org] = await tx
      .select({
        name: organizations.name,
        tier: organizations.tier,
        division: organizations.division,
        standardVersion: organizations.standardVersion,
        integrityScore: organizations.integrityScore,
        certificationStatus: organizations.certificationStatus,
        primaryAiOfficer: organizations.primaryAiOfficer,
      })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);

    if (!org) return null;

    const [cert] = await tx
      .select({
        certNumber: issuedCertifications.certNumber,
        standard: issuedCertifications.standard,
        status: issuedCertifications.status,
        issueDate: issuedCertifications.issueDate,
        expiryDate: issuedCertifications.expiryDate,
      })
      .from(issuedCertifications)
      .where(eq(issuedCertifications.orgId, orgId))
      .orderBy(desc(issuedCertifications.issueDate))
      .limit(1);

    // ── The inventory itself. This is the part a counts-only extract cannot
    //    give a client: what they actually have.
    const systems = await tx
      .select({
        id: aiSystems.id,
        name: aiSystems.name,
        version: aiSystems.version,
        purpose: aiSystems.purpose,
        division: aiSystems.division,
        riskTier: aiSystems.riskTier,
        lifecycleStage: aiSystems.lifecycleStage,
        status: aiSystems.status,
        isSandbox: aiSystems.isSandbox,
        updatedAt: aiSystems.updatedAt,
      })
      .from(aiSystems)
      .where(and(eq(aiSystems.orgId, orgId), eq(aiSystems.isActive, true)))
      .orderBy(desc(aiSystems.riskTier), aiSystems.name);

    const persons = await tx
      .select({
        id: accountablePersons.id,
        name: accountablePersons.name,
        jobTitle: accountablePersons.jobTitle,
        email: accountablePersons.email,
        declarationVersion: accountablePersons.declarationVersion,
        declarationAcceptedAt: accountablePersons.declarationAcceptedAt,
      })
      .from(accountablePersons)
      .where(and(eq(accountablePersons.orgId, orgId), isNull(accountablePersons.supersededAt)))
      .orderBy(desc(accountablePersons.declarationAcceptedAt));

    const requirementsByStatus = await tx
      .select({ status: auditRequirements.status, n: count() })
      .from(auditRequirements)
      .where(eq(auditRequirements.orgId, orgId))
      .groupBy(auditRequirements.status);

    const requirementsByRight = await tx
      .select({ right: auditRequirements.rightCode, status: auditRequirements.status, n: count() })
      .from(auditRequirements)
      .where(eq(auditRequirements.orgId, orgId))
      .groupBy(auditRequirements.rightCode, auditRequirements.status);

    const evidenceByOutcome = await tx
      .select({ outcome: auditDocuments.verificationOutcome, n: count() })
      .from(auditDocuments)
      .where(eq(auditDocuments.orgId, orgId))
      .groupBy(auditDocuments.verificationOutcome);

    const [verified] = await tx
      .select({ last: max(auditDocuments.verifiedAt) })
      .from(auditDocuments)
      .where(eq(auditDocuments.orgId, orgId));

    const findings = await tx
      .select({
        id: auditFindings.id,
        severity: auditFindings.severity,
        title: auditFindings.title,
        status: auditFindings.status,
        raisedAt: auditFindings.raisedAt,
        dueAt: auditFindings.dueAt,
      })
      .from(auditFindings)
      .where(eq(auditFindings.orgId, orgId))
      .orderBy(desc(auditFindings.raisedAt))
      .limit(200);

    // Distinct system names that have actually logged a decision. Compared
    // against the declared inventory below: a name that appears here and not
    // there is a system nobody registered.
    const decidingSystems = await tx
      .select({ systemName: decisionRecords.systemName, n: count() })
      .from(decisionRecords)
      .where(eq(decisionRecords.orgId, orgId))
      .groupBy(decisionRecords.systemName);

    const [decisionTotals] = await tx
      .select({ n: count(), last: max(decisionRecords.createdAt) })
      .from(decisionRecords)
      .where(eq(decisionRecords.orgId, orgId));

    const [overrideTotals] = await tx
      .select({ n: count() })
      .from(decisionRecords)
      .where(and(eq(decisionRecords.orgId, orgId), eq(decisionRecords.isHumanOverride, true)));

    // Usage/spend as reported by the org's own tooling - see
    // llmUsageRecords's own comment for why AIC only ever reads rows someone
    // else pushed, never a provider directly. Aggregated by provider+model
    // rather than returned row-by-row, matching this file's "counts, not
    // raw logs" convention everywhere else.
    const usageByProviderModel = await tx
      .select({
        provider: llmUsageRecords.provider,
        model: llmUsageRecords.model,
        requests: sum(llmUsageRecords.requests),
        inputTokens: sum(llmUsageRecords.inputTokens),
        outputTokens: sum(llmUsageRecords.outputTokens),
        costUsd: sum(llmUsageRecords.costUsd),
      })
      .from(llmUsageRecords)
      .where(eq(llmUsageRecords.orgId, orgId))
      .groupBy(llmUsageRecords.provider, llmUsageRecords.model);

    const usageWithSystemName = await tx
      .selectDistinct({ systemName: llmUsageRecords.systemName, provider: llmUsageRecords.provider })
      .from(llmUsageRecords)
      .where(and(eq(llmUsageRecords.orgId, orgId), isNotNull(llmUsageRecords.systemName)));

    const [usageLast] = await tx
      .select({ last: max(llmUsageRecords.createdAt), periodEnd: max(llmUsageRecords.periodEnd) })
      .from(llmUsageRecords)
      .where(eq(llmUsageRecords.orgId, orgId));

    const correctionsByStatus = await tx
      .select({ status: correctionRequests.status, n: count() })
      .from(correctionRequests)
      .where(eq(correctionRequests.orgId, orgId))
      .groupBy(correctionRequests.status);

    const tally = (rows: { status: string | null; n: number }[]) =>
      Object.fromEntries(rows.map((r) => [r.status ?? 'UNSPECIFIED', Number(r.n)]));

    const decisions = Number(decisionTotals?.n ?? 0);
    const overrides = Number(overrideTotals?.n ?? 0);

    const declaredNames = new Set(systems.map((s) => s.name.trim().toLowerCase()));
    const undeclared = decidingSystems
      .filter((d) => d.systemName && !declaredNames.has(d.systemName.trim().toLowerCase()))
      .map((d) => ({ name: d.systemName, decisions: Number(d.n) }));

    const undeclaredUsing = usageWithSystemName
      .filter((u) => u.systemName && !declaredNames.has(u.systemName.trim().toLowerCase()))
      .map((u) => ({ name: u.systemName as string, provider: u.provider }));

    const openFindings = findings.filter((f) => f.status !== 'CLOSED' && f.status !== 'WITHDRAWN');
    const now = Date.now();
    const overdueFindings = openFindings.filter((f) => f.dueAt && new Date(f.dueAt).getTime() < now);

    const requirementTally = tally(requirementsByStatus);
    const requirementsTotal = Object.values(requirementTally).reduce((a, b) => a + b, 0);
    const requirementsNotStarted = requirementTally['PENDING'] ?? 0;

    const evidenceTally = tally(evidenceByOutcome.map((r) => ({ status: r.outcome, n: r.n })));
    const evidenceRejected = evidenceTally['REJECTED'] ?? 0;

    const systemsWithoutPurpose = systems.filter((s) => !s.purpose || !s.purpose.trim());
    const productionSystems = systems.filter(
      (s) => (s.lifecycleStage ?? '').toUpperCase() === 'PRODUCTION'
    );

    const gaps = deriveGaps({
      accountablePersons: persons.length,
      declaredSystems: systems.length,
      undeclaredButDeciding: undeclared,
      undeclaredButUsing: undeclaredUsing,
      systemsWithoutPurpose: systemsWithoutPurpose.map((s) => s.name),
      overdueFindings: overdueFindings.map((f) => f.title),
      evidenceRejected,
      requirementsNotStarted,
      decisions,
      overrides,
    });

    return {
      generatedAt: new Date().toISOString(),
      organisation: {
        name: org.name,
        division: org.division,
        divisionName: org.division ? DIVISION_NAMES[org.division] ?? null : null,
        standardVersion: org.standardVersion,
        tier: org.tier,
        certificationStatus: org.certificationStatus,
        primaryAiOfficer: org.primaryAiOfficer,
        integrityScore: org.integrityScore,
      },
      certificate: cert
        ? {
            number: cert.certNumber,
            standard: cert.standard,
            status: cert.status,
            issued: cert.issueDate,
            expires: cert.expiryDate,
          }
        : null,
      inventory: {
        systems,
        total: systems.length,
        inProduction: productionSystems.length,
        inSandbox: systems.filter((s) => s.isSandbox).length,
        withoutStatedPurpose: systemsWithoutPurpose.length,
        undeclaredButDeciding: undeclared,
      },
      accountability: {
        persons,
        onRecord: persons.length,
      },
      requirements: {
        byStatus: requirementTally,
        byRight: requirementsByRight.map((r) => ({
          right: r.right ?? 'UNSPECIFIED',
          status: r.status ?? 'UNSPECIFIED',
          count: Number(r.n),
        })),
        total: requirementsTotal,
      },
      evidence: {
        byVerificationOutcome: evidenceTally,
        lastVerifiedAt: verified?.last ?? null,
      },
      findings: {
        open: openFindings.map((f) => ({
          id: f.id,
          severity: f.severity,
          title: f.title,
          status: f.status,
          raisedAt: f.raisedAt,
          dueAt: f.dueAt,
          overdue: !!(f.dueAt && new Date(f.dueAt).getTime() < now),
        })),
        openCount: openFindings.length,
        overdueCount: overdueFindings.length,
      },
      decisions: {
        recorded: decisions,
        humanOverrides: overrides,
        // Stated with its denominator on purpose: a percentage with the sample
        // size hidden is the easiest number here to misread.
        humanOverrideRate: decisions > 0 ? Number((overrides / decisions).toFixed(4)) : null,
        lastRecordedAt: decisionTotals?.last ?? null,
        systemsLoggingDecisions: decidingSystems.length,
        // Names, not just the count: the continuity observer needs to know
        // which declared systems have never logged anything, and that is not
        // derivable from a count.
        systemNamesLoggingDecisions: decidingSystems
          .map((d) => d.systemName)
          .filter((n): n is string => !!n),
      },
      corrections: {
        byStatus: tally(correctionsByStatus),
      },
      // Provider/model spend as reported by the org's own tooling. Never a
      // score, same as everything else here - just what's been pushed to
      // AIC and when. See llmUsageRecords for why AIC never calls a
      // provider itself to get these numbers.
      usage: {
        byProviderModel: usageByProviderModel.map((u) => ({
          provider: u.provider,
          model: u.model,
          requests: Number(u.requests ?? 0),
          inputTokens: Number(u.inputTokens ?? 0),
          outputTokens: Number(u.outputTokens ?? 0),
          costUsd: Number(u.costUsd ?? 0),
        })),
        providers: usageByProviderModel.length > 0
          ? Array.from(new Set(usageByProviderModel.map((u) => u.provider))).length
          : 0,
        totalCostUsd: usageByProviderModel.reduce((acc, u) => acc + Number(u.costUsd ?? 0), 0),
        lastIngestedAt: usageLast?.last ?? null,
        lastPeriodEnd: usageLast?.periodEnd ?? null,
        undeclaredAttributions: undeclaredUsing,
      },
      gaps,
      scope:
        'This overview reports what has been declared to and verified by AIC. It is not a ' +
        'determination of legal compliance in any jurisdiction, and completeness of the AI ' +
        'inventory remains a declaration by the organisation.',
    };
  });
}
