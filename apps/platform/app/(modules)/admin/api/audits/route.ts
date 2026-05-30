import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { getSession } from '../../../lib/auth'

export async function GET() {
  const session: any = await getSession()
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'AUDITOR')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Fetch audit activity grouped by organization with recent logs
    const orgsResult = await query(
      `SELECT o.id, o.name, o.tier, o.integrity_score,
              COUNT(al.id) as total_audits,
              COUNT(al.id) FILTER (WHERE al.created_at > NOW() - INTERVAL '30 days') as recent_audits,
              MAX(al.created_at) as last_audit_at,
              COUNT(i.id) FILTER (WHERE i.status = 'OPEN') as open_findings
       FROM organizations o
       LEFT JOIN audit_logs al ON al.org_id = o.id
       LEFT JOIN incidents i ON i.org_id = o.id
       GROUP BY o.id, o.name, o.tier, o.integrity_score
       ORDER BY MAX(al.created_at) DESC NULLS LAST
       LIMIT 20`
    )

    // Recent audit logs across all orgs
    const logsResult = await query(
      `SELECT al.id, al.event_type, al.system_name, al.status, al.created_at, al.integrity_hash,
              o.name as org_name, o.tier as org_tier
       FROM audit_logs al
       JOIN organizations o ON al.org_id = o.id
       ORDER BY al.created_at DESC
       LIMIT 25`
    )

    // Summary stats
    const statsResult = await query(
      `SELECT
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as audits_this_week,
         COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as audits_this_month,
         COUNT(DISTINCT org_id) as orgs_audited,
         COUNT(*) as total_audits
       FROM audit_logs`
    )

    return NextResponse.json({
      organizations: orgsResult.rows,
      recentLogs: logsResult.rows,
      stats: statsResult.rows[0]
    })
  } catch (error) {
    console.error('Admin Audits API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session: any = await getSession()
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { orgId, eventType, systemName, details } = body

    if (!orgId || !eventType) {
      return NextResponse.json({ error: 'orgId and eventType are required' }, { status: 400 })
    }

    const result = await query(
      `INSERT INTO audit_logs (org_id, event_type, system_name, details, status)
       VALUES ($1, $2, $3, $4, 'PENDING')
       RETURNING *`,
      [orgId, eventType, systemName || 'MANUAL_AUDIT', JSON.stringify(details || {})]
    )

    return NextResponse.json({ success: true, audit: result.rows[0] })
  } catch (error) {
    console.error('Create Audit Error:', error)
    return NextResponse.json({ error: 'Failed to create audit' }, { status: 500 })
  }
}
