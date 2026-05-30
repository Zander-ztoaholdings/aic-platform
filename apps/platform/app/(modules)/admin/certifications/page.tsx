'use client'

import { useState } from 'react'
import AdminShell from '../components/AdminShell'

interface Certification {
  id: string
  organization: string
  tier: 'TIER_1' | 'TIER_2' | 'TIER_3'
  status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'SUSPENDED'
  issued_at: string
  expires_at: string
  integrity_score: number
  last_audit: string
  ai_systems: number
}

const tierInfo = {
  TIER_1: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/20' },
  TIER_2: { label: 'Elevated', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  TIER_3: { label: 'Standard', color: 'text-green-400', bg: 'bg-green-500/20' },
}

const statusInfo = {
  ACTIVE: { label: 'Active', color: 'text-green-400', bg: 'bg-green-500/20' },
  EXPIRING_SOON: { label: 'Expiring Soon', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
  EXPIRED: { label: 'Expired', color: 'text-red-400', bg: 'bg-red-500/20' },
  SUSPENDED: { label: 'Suspended', color: 'text-gray-400', bg: 'bg-gray-500/20' },
}

export default function CertificationsPage() {
  const [selectedTier, setSelectedTier] = useState<string>('ALL')

  const certifications: Certification[] = [
    {
      id: 'AIC-2026-0001',
      organization: 'FirstRand Bank',
      tier: 'TIER_1',
      status: 'ACTIVE',
      issued_at: '2026-01-01',
      expires_at: '2027-01-01',
      integrity_score: 94,
      last_audit: '2026-01-15',
      ai_systems: 12
    },
    {
      id: 'AIC-2026-0002',
      organization: 'Discovery Health',
      tier: 'TIER_1',
      status: 'ACTIVE',
      issued_at: '2025-12-15',
      expires_at: '2026-12-15',
      integrity_score: 91,
      last_audit: '2026-01-20',
      ai_systems: 8
    },
    {
      id: 'AIC-2026-0003',
      organization: 'Vodacom SA',
      tier: 'TIER_2',
      status: 'EXPIRING_SOON',
      issued_at: '2025-02-10',
      expires_at: '2026-02-10',
      integrity_score: 87,
      last_audit: '2025-11-10',
      ai_systems: 3
    },
    {
      id: 'AIC-2025-0089',
      organization: 'Takealot Group',
      tier: 'TIER_2',
      status: 'ACTIVE',
      issued_at: '2025-10-01',
      expires_at: '2026-10-01',
      integrity_score: 89,
      last_audit: '2026-01-05',
      ai_systems: 4
    },
    {
      id: 'AIC-2025-0045',
      organization: 'Old Mutual',
      tier: 'TIER_1',
      status: 'ACTIVE',
      issued_at: '2025-08-15',
      expires_at: '2026-08-15',
      integrity_score: 92,
      last_audit: '2025-12-20',
      ai_systems: 6
    },
  ]

  const filtered = selectedTier === 'ALL'
    ? certifications
    : certifications.filter(c => c.tier === selectedTier)

  const stats = {
    total: certifications.length,
    tier1: certifications.filter(c => c.tier === 'TIER_1').length,
    tier2: certifications.filter(c => c.tier === 'TIER_2').length,
    tier3: certifications.filter(c => c.tier === 'TIER_3').length,
    expiringSoon: certifications.filter(c => c.status === 'EXPIRING_SOON').length,
  }

  return (
    <AdminShell>
      <div className="space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-5 gap-6">
          <div className="bg-[#1c1c1c] p-6 rounded-xl border border-gray-800">
            <p className="text-gray-500 text-xs uppercase mb-2">Total Active</p>
            <p className="text-3xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-[#1c1c1c] p-6 rounded-xl border border-gray-800">
            <p className="text-gray-500 text-xs uppercase mb-2">Tier 1 (Critical)</p>
            <p className="text-3xl font-bold text-red-500">{stats.tier1}</p>
          </div>
          <div className="bg-[#1c1c1c] p-6 rounded-xl border border-gray-800">
            <p className="text-gray-500 text-xs uppercase mb-2">Tier 2 (Elevated)</p>
            <p className="text-3xl font-bold text-orange-500">{stats.tier2}</p>
          </div>
          <div className="bg-[#1c1c1c] p-6 rounded-xl border border-gray-800">
            <p className="text-gray-500 text-xs uppercase mb-2">Tier 3 (Standard)</p>
            <p className="text-3xl font-bold text-green-500">{stats.tier3}</p>
          </div>
          <div className="bg-[#1c1c1c] p-6 rounded-xl border border-yellow-800/50">
            <p className="text-yellow-500 text-xs uppercase mb-2">Expiring Soon</p>
            <p className="text-3xl font-bold text-yellow-500">{stats.expiringSoon}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {['ALL', 'TIER_1', 'TIER_2', 'TIER_3'].map((tier) => (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedTier === tier
                  ? 'bg-blue-600 text-aic-paper'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tier === 'ALL' ? 'All Tiers' : tier.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Certifications Grid */}
        <div className="grid grid-cols-2 gap-6">
          {filtered.map((cert) => (
            <div
              key={cert.id}
              className="bg-[#1c1c1c] rounded-xl border border-gray-800 p-6 hover:border-gray-700 transition-colors"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="font-mono text-sm text-gray-500">{cert.id}</p>
                  <h3 className="text-xl font-bold mt-1">{cert.organization}</h3>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${tierInfo[cert.tier].bg} ${tierInfo[cert.tier].color}`}>
                    {tierInfo[cert.tier].label}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo[cert.status].bg} ${statusInfo[cert.status].color}`}>
                    {statusInfo[cert.status].label}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Integrity Score</p>
                  <p className={`text-2xl font-bold ${
                    cert.integrity_score >= 90 ? 'text-green-500' :
                    cert.integrity_score >= 70 ? 'text-yellow-500' : 'text-red-500'
                  }`}>
                    {cert.integrity_score}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">AI Systems</p>
                  <p className="text-2xl font-bold">{cert.ai_systems}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Last Audit</p>
                  <p className="text-sm font-mono">{cert.last_audit}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm border-t border-gray-800 pt-4">
                <div className="text-gray-500">
                  Valid until: <span className="text-aic-paper">{cert.expires_at}</span>
                </div>
                <div className="flex gap-3">
                  <button className="text-blue-400 hover:text-blue-300">View Details</button>
                  <button className="text-gray-400 hover:text-gray-300">Schedule Audit</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  )
}
