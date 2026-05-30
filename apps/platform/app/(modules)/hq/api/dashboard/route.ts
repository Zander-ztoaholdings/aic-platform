import { NextResponse } from 'next/server'
import { query } from '../../../lib/db'
import { getSession } from '../../../lib/auth'

export async function GET() {
  const session: any = await getSession()
  if (!session || (session.user.role !== 'ADMIN' && session.user.role !== 'AUDITOR')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Pipeline: count of organizations and their combined potential value
    const orgsResult = await query(
      `SELECT COUNT(*) as total_orgs,
              COUNT(*) FILTER (WHERE tier = 'TIER_1') as tier1,
              COUNT(*) FILTER (WHERE tier = 'TIER_2') as tier2,
              COUNT(*) FILTER (WHERE tier = 'TIER_3') as tier3,
              AVG(integrity_score) as avg_score
       FROM organizations`
    )

    // Lead pipeline
    const leadsResult = await query(
      `SELECT COUNT(*) as total_leads,
              COUNT(*) FILTER (WHERE score > 70) as high_intent
       FROM leads`
    )

    // Active auditors (users with AUDITOR role)
    const auditorsResult = await query(
      `SELECT COUNT(*) as total FROM users WHERE role = 'AUDITOR' OR role = 'COMPLIANCE_OFFICER'`
    )

    // Open incidents (citizen appeals)
    const incidentsResult = await query(
      `SELECT COUNT(*) as total FROM incidents WHERE status = 'OPEN'`
    )

    // Top organizations for pipeline view
    const topOrgsResult = await query(
      `SELECT id, name, tier, integrity_score FROM organizations
       ORDER BY integrity_score DESC LIMIT 5`
    )

    // Monthly audit activity for chart (last 12 months)
    const activityResult = await query(
      `SELECT DATE_TRUNC('month', created_at) as month,
              COUNT(*) as count
       FROM audit_logs
       WHERE created_at > NOW() - INTERVAL '12 months'
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY month ASC`
    )

    const stats = orgsResult.rows[0]
    const leads = leadsResult.rows[0]

    return NextResponse.json({
      kpis: {
        totalOrgs: parseInt(stats.total_orgs) || 0,
        tier1Count: parseInt(stats.tier1) || 0,
        avgScore: Math.round(parseFloat(stats.avg_score) || 0),
        totalLeads: parseInt(leads.total_leads) || 0,
        highIntentLeads: parseInt(leads.high_intent) || 0,
        activeAuditors: parseInt(auditorsResult.rows[0].total) || 0,
        openAppeals: parseInt(incidentsResult.rows[0].total) || 0
      },
      topOrganizations: topOrgsResult.rows,
      monthlyActivity: activityResult.rows.map((r: any) => ({
        month: new Date(r.month).toLocaleDateString('en-ZA', { month: 'short' }),
        count: parseInt(r.count)
      }))
    })
  } catch (error) {
    console.error('HQ Dashboard API Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
