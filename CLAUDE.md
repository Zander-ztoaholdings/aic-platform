# CLAUDE.md - AI Integrity Certification (AIC) Platform

## Project Overview

AIC is the global standard for human accountability in automated decision systems. We certify that human empathy and accountability remain in the loop for every consequential automated decision — starting in South Africa with POPIA Section 71 as the market entry regulatory anchor, and built for global applicability. The framework is built on the 5 Algorithmic Rights and operationalised through a risk-based three-tier certification model.

**Core Philosophy:** "We certify that human empathy and accountability remain in the loop."

## Architecture

This is a **monorepo** using npm workspaces with 4 primary applications (Next.js and FastAPI) and 7 shared packages.

```
aic-platform/
├── apps/
│   ├── web/                # Marketing site & citizen portal (port 3000)
│   ├── platform/           # Unified SaaS/Admin/HQ/Internal dashboard (port 3001)
│   ├── governance-agent/   # AI-powered governance assistant (MCP server)
│   └── engine/             # Python audit engine microservice (port 8000)
├── packages/
│   ├── ui/            # Shared React components (@aic/ui)
│   ├── auth/          # Shared NextAuth v5 utilities (@aic/auth)
│   ├── db/            # Drizzle ORM schema & services (@aic/db)
│   ├── legal/         # Legal/compliance utilities (@aic/legal)
│   ├── middleware/    # Shared RBAC & security middleware (@aic/middleware)
│   ├── notifications/ # Shared notification logic (@aic/notifications)
│   └── types/         # Shared TypeScript types (@aic/types)
├── docs/              # Strategic & technical documentation (Obsidian Vault)
└── docker-compose.yml # PostgreSQL + PgAdmin orchestration
```

## Tech Stack

### Frontend (apps/web, apps/platform)
- **Framework:** Next.js 15 (App Router)
- **Runtime:** React 19
- **Styling:** Tailwind CSS 4 (PostCSS)
- **Animations:** Framer Motion 12
- **Types:** TypeScript 5.9 (strict mode)

### Backend
- **Unified API:** Next.js Route Handlers in `apps/platform/app/api/`
- **Database:** PostgreSQL 15 (Drizzle ORM + raw `pg` driver)
- **Auth:** NextAuth.js v5-beta (shared across `web` and `platform`)

### Audit Engine (apps/engine)
- **Framework:** FastAPI with slowapi rate limiting
- **Data processing:** Pandas, SciPy, NumPy
- **XAI:** SHAP feature importance validation
- **Crypto:** RSA-3072 signing via `cryptography`

## Development Commands

```bash
# Start all apps concurrently
npm run dev

# Start individual apps
npm run dev:web        # Marketing site on :3000
npm run dev:platform   # Unified dashboard on :3001

# Start database and infrastructure
docker-compose up -d

# Start engine
cd apps/engine && uvicorn app.main:app --reload --port 8000

# Build all apps
npm run build

# Run all tests
npm test                          # TypeScript tests (Vitest, via Turborepo)
npm run test:engine               # Python tests (pytest)
npm run test:e2e                  # End-to-end tests (Playwright)
```

## Engine Services

| Service | File | Purpose |
|---------|------|---------|
| Bias Analysis | `bias_analysis.py` | Four-fifths rule, disparate impact, chi-square tests |
| Fairness Metrics | `fairness_metrics.py` | Theil index, Atkinson index, epsilon-differential fairness |
| Explainability | `explainability.py` | SHAP-based feature importance (global + local) |
| Drift Monitoring | `drift_monitoring.py` | PSI + Jensen-Shannon + KS test via `DriftMonitor` class |
| Hash Chain | `hash_chain.py` | SHA-256 hash chain for audit immutability |
| Scoring | `scoring.py` | Integrity score calculation |
| Privacy Audit | `privacy_audit.py` | Data privacy compliance checks |
| Labor Audit | `labor_audit.py` | Labor practice auditing |

## Authentication & RBAC

### Role Model (4-tier, see `apps/platform/lib/roles.ts`)

`users.role` is a single enum spanning both AIC's own staff and a client
organisation's staff:

- `ORG_USER` / `ORG_ADMIN` - a client organisation's own people. Both can
  operate the estate day to day (declare/edit systems, submit evidence,
  record decisions); only `ORG_ADMIN` can invite teammates, manage API
  keys/billing. There is no read-only org-side tier.
- `AIC_AUDITOR` / `AIC_SUPER_ADMIN` - AIC's own people, not org members.

`role` is used only for coarse, low-stakes purposes (sidebar, name badge,
what a client-org member can do in their own org). It is **not** the access
gate for AIC-staff actions - that stays on `hasCapability(userId, slug)`
(`apps/platform/lib/rbac.ts`) and the `isSuperAdmin` boolean, to avoid a
previously-shipped bug where an org's own admin satisfied a check meant for
AIC staff.

## Key Rules

- **SQL Injection Prevention:** Always use parameterized queries via Drizzle ORM.
- **Multi-tenancy:** Enforce tenant isolation using the `org_id` filter and `getTenantDb` helper.
- **Audit trail:** All sensitive operations must generate a SHA-256 hash-chained log with RSA signatures.
- **RBAC:** Use the `hasCapability(userId, slug)` helper from `apps/platform/lib/rbac.ts` for granular (AIC-staff) permissions; use `apps/platform/lib/roles.ts` only for coarse org-role checks.

## Project Documentation

The repository follows an **Obsidian Vault** structure in the `docs/` folder:
- `docs/01-strategy/` - Business and strategic planning.
- `docs/02-technical/` - Architecture, schema, and API docs.
- `docs/03-legal-compliance/` - Legal frameworks and regulatory alignment.
- `docs/04-business-ops/` - Operational guides and pitch materials.

---

**Copyright 2026 AI Integrity Certification (AIC). Proprietary - Johannesburg, South Africa.**
