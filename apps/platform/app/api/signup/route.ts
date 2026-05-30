import { NextRequest, NextResponse } from 'next/server';
import { query } from '../../../lib/db';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { orgName, tier, name, email, password } = body;

        // Input validation
        if (!orgName || typeof orgName !== 'string' || orgName.trim().length < 2 || orgName.length > 200) {
            return NextResponse.json({ error: 'Organization name must be 2-200 characters' }, { status: 400 });
        }
        if (!tier || !['TIER_1', 'TIER_2', 'TIER_3'].includes(tier)) {
            return NextResponse.json({ error: 'Valid tier is required (TIER_1, TIER_2, TIER_3)' }, { status: 400 });
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

        // 1. Create the organization
        const orgResult = await query(
            'INSERT INTO organizations (name, tier, integrity_score) VALUES ($1, $2, 0) RETURNING id',
            [orgName.trim(), tier]
        );
        const orgId = orgResult.rows[0].id;

        // 2. Create the admin user
        const hashedPassword = await bcrypt.hash(password, 12);
        const userResult = await query(
            `INSERT INTO users (name, email, password_hash, role, org_id)
             VALUES ($1, $2, $3, 'ADMIN', $4) RETURNING id, name, email, role`,
            [name.trim(), email.toLowerCase(), hashedPassword, orgId]
        );

        // 3. Generate initial audit requirements
        const initialRequirements = [
            ['POPIA Section 71 Compliance Policy', 'Formal document outlining human intervention procedures for algorithmic decisions.', 'DOCUMENTATION'],
            ['AI System Inventory', 'Complete inventory of all production AI/ML models and their business purpose.', 'DOCUMENTATION'],
            ['Human-in-the-Loop Interface', 'Technical proof of manual override capabilities for automated decisions.', 'OVERSIGHT'],
            ['Decision Review Process', 'Documented process for human review of flagged algorithmic decisions.', 'OVERSIGHT'],
            ['Algorithmic Impact Assessment', 'Assessment of potential impact of AI systems on affected individuals.', 'REPORTS'],
            ['Monthly Compliance Report Template', 'Template for ongoing compliance reporting to designated authority.', 'REPORTS'],
            ['Initial Bias Audit', 'Baseline statistical analysis of primary model datasets for demographic bias.', 'TECHNICAL'],
            ['Model Explainability Report', 'SHAP/LIME analysis demonstrating model decision transparency.', 'TECHNICAL']
        ];

        for (const [title, desc, cat] of initialRequirements) {
            await query(
                'INSERT INTO audit_requirements (org_id, title, description, category, status) VALUES ($1, $2, $3, $4, $5)',
                [orgId, title, desc, cat, 'PENDING']
            );
        }

        // 4. Create welcome notification
        await query(
            `INSERT INTO notifications (org_id, title, message, type)
             VALUES ($1, $2, $3, $4)`,
            [orgId, 'Welcome to AIC Pulse', 'Your certification roadmap has been generated. Complete your audit requirements to achieve full certification.', 'WELCOME']
        );

        return NextResponse.json({
            success: true,
            orgId,
            user: userResult.rows[0]
        }, { status: 201 });

    } catch (error) {
        console.error('Signup Error:', error);
        return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
    }
}
