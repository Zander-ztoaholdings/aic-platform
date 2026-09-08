import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { checkRateLimit, getClientIP } from '@/lib/rate-limit';
import {
  fetchPublishedStandard,
  requirementsForDivision,
  isValidDivision,
  DIVISIONS,
} from '@/lib/standard';

/**
 * Registers an organisation and its first administrator.
 *
 * This used to ask for an "AI Risk Tier" (TIER_1/2/3) — a concept that appears
 * nowhere in the published standard — and then seed eight hand-written
 * requirements whose text existed in no published document. Two of those eight
 * were never even displayed.
 *
 * It now asks the question the standard actually turns on: the Division. Only
 * 16 of the 44 published requirements are universal; the rest depend on the
 * Division, so a requirement set generated without it could not have been right
 * for anybody. Requirements are seeded from aic-web's /api/standard, each row
 * recording the clause it came from and the standard version it belongs to.
 */

export async function POST(request: NextRequest) {
    try {
        // This endpoint writes an organisation and a user row per call, and it
        // is reachable without a session. Unthrottled, that is a free write
        // primitive against the production database for anyone who finds it.
        const ip = getClientIP(request);
        const { allowed } = checkRateLimit(`signup:${ip}`, 5, 60 * 60_000);
        if (!allowed) {
            return NextResponse.json(
                { error: 'Too many signup attempts. Please try again later.' },
                { status: 429 }
            );
        }

        const body = await request.json();
        const { orgName, division, name, email, password } = body;

        // Input validation
        if (!orgName || typeof orgName !== 'string' || orgName.trim().length < 2 || orgName.length > 200) {
            return NextResponse.json({ error: 'Organization name must be 2-200 characters' }, { status: 400 });
        }
        if (!isValidDivision(division)) {
            return NextResponse.json({
                error: 'A Division is required',
                message: 'Choose the Division that describes how decisions are actually made: ' +
                    Object.entries(DIVISIONS).map(([n, d]) => `${n} ${d.name}`).join(', ') + '.',
            }, { status: 400 });
        }
        if (!name || typeof name !== 'string' || name.trim().length < 2) {
            return NextResponse.json({ error: 'Name must be at least 2 characters' }, { status: 400 });
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
        }
        if (!password || password.length < 8) {
            return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
        }

        // Check if email already exists
        const existingUser = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
        if (existingUser.rows.length > 0) {
            return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
        }

        // Load the published standard BEFORE writing anything. An organisation
        // created without the requirement set that applies to it is a broken
        // record for a certification body, so this fails cleanly and asks for a
        // retry rather than half-registering someone.
        let standard;
        try {
            standard = await fetchPublishedStandard();
        } catch (error) {
            console.error('Signup: could not load published standard:', error);
            return NextResponse.json({
                error: 'Registration is temporarily unavailable',
                message: 'The published standard could not be loaded, so your certification roadmap could not be generated. Nothing was created — please try again shortly.',
            }, { status: 503 });
        }

        const applicable = requirementsForDivision(standard, division);
        if (applicable.length === 0) {
            console.error(`Signup: standard ${standard.version} yielded no requirements for Division ${division}`);
            return NextResponse.json({ error: 'Registration is temporarily unavailable' }, { status: 503 });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const result = await withTransaction(async (tx) => {
            // 1. The organisation, recorded against the Division it will be
            //    assessed in and the version of the standard used.
            const orgResult = await tx(
                `INSERT INTO organizations (name, division, standard_version, integrity_score)
                 VALUES ($1, $2, $3, 0) RETURNING id`,
                [orgName.trim(), division, standard.version]
            );
            const orgId = orgResult.rows[0].id;

            // 2. The admin user
            const userResult = await tx(
                `INSERT INTO users (name, email, password_hash, role, org_id)
                 VALUES ($1, $2, $3, 'ADMIN', $4) RETURNING id, name, email, role`,
                [name.trim(), email.toLowerCase(), hashedPassword, orgId]
            );

            // 3. The requirements that actually apply, straight from the
            //    published standard. Each row keeps its clause code, the Right
            //    it serves and the evidence the standard asks for, so an
            //    assessment can always be traced back to what was published.
            //
            //    `category` is set to the Right as well as `right_code`: the
            //    older column is still read in places, and the five Rights are
            //    the correct grouping now that the invented DOCUMENTATION /
            //    TECHNICAL / OVERSIGHT / REPORTS buckets are gone.
            for (const req of applicable) {
                await tx(
                    `INSERT INTO audit_requirements
                       (org_id, code, right_code, category, title, evidence_guidance, standard_version, status)
                     VALUES ($1, $2, $3, $3, $4, $5, $6, 'PENDING')`,
                    [orgId, req.code, req.right, req.text, req.evidence, standard.version]
                );
            }

            // 4. Welcome notification
            await tx(
                `INSERT INTO notifications (org_id, title, message, type)
                 VALUES ($1, $2, $3, $4)`,
                [
                    orgId,
                    'Welcome to AIC',
                    `Your organisation is registered in Division ${division} (${DIVISIONS[division].name}). ` +
                    `${applicable.length} of the ${standard.requirements.length} requirements in standard ${standard.version} apply to you, and they are now on your roadmap.`,
                    'WELCOME',
                ]
            );

            return { orgId, user: userResult.rows[0] };
        });

        return NextResponse.json({
            success: true,
            orgId: result.orgId,
            user: result.user,
            division: { number: division, name: DIVISIONS[division].name },
            standard: { version: standard.version, issued: standard.issued },
            requirementsCreated: applicable.length,
        }, { status: 201 });

    } catch (error) {
        console.error('Signup Error:', error);
        return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
    }
}
