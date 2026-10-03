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
  TIER_1: { label: 'Critical', color: 'text-red-700', bg: 'bg-red-50' },
  TIER_2: { label: 'Elevated', color: 'text-orange-700', bg: 'bg-orange-50' },
  TIER_3: { label: 'Standard', color: 'text-green-700', bg: 'bg-green-50' },
}

const statusInfo = {
  ACTIVE: { label: 'Active', color: 'text-green-700', bg: 'bg-green-50' },
  EXPIRING_SOON: { label: 'Expiring Soon', color: 'text-amber-700', bg: 'bg-yellow-50' },
  EXPIRED: { label: 'Expired', color: 'text-red-700', bg: 'bg-red-50' },
  SUSPENDED: { label: 'Suspended', color: 'text-gray-500', bg: 'bg-gray-500/20' },
}

export default function CertificationsPage() {
  const [selectedTier, setSelectedTier] = useState<string>('ALL')

  const certifications: Certification[] = [
    {
      id: 'AIC-2026-0001',
      organization: 'Example Bank Ltd (demo)',
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
      organization: 'Example Healthcare Group (demo)',
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
      organization: 'Example Telecom Ltd (demo)',
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
      organization: 'Example Retail Group (demo)',
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
      organization: 'Example Insurance Group (demo)',
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
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-[#dde2e8]">
            <p className="text-gray-500 text-xs first-cap mb-2">Total Active</p>
            <p className="text-3xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-[#dde2e8]">
            <p className="text-gray-500 text-xs first-cap mb-2">Tier 1 (Critical)</p>
            <p className="text-3xl font-bold text-red-700">{stats.tier1}</p>
          </div>
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-[#dde2e8]">
            <p className="text-gray-500 text-xs first-cap mb-2">Tier 2 (Elevated)</p>
            <p className="text-3xl font-bold text-orange-700">{stats.tier2}</p>
          </div>
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-[#dde2e8]">
            <p className="text-gray-500 text-xs first-cap mb-2">Tier 3 (Standard)</p>
            <p className="text-3xl font-bold text-green-700">{stats.tier3}</p>
          </div>
          <div className="bg-white p-4 sm:p-6 rounded-xl border border-yellow-200">
            <p className="text-amber-700 text-xs first-cap mb-2">Expiring Soon</p>
            <p className="text-3xl font-bold text-amber-700">{stats.expiringSoon}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
          {['ALL', 'TIER_1', 'TIER_2', 'TIER_3'].map((tier) => (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedTier === tier
                  ? 'bg-[#0e1b2c] text-aic-paper'
                  : 'bg-[#f5f7f9] text-gray-500 hover:bg-[#eef1f5]'
              }`}
            >
              {tier === 'ALL' ? 'All tiers' : tier.replace('TIER_', 'Tier ')}
            </button>
          ))}
        </div>

        {/* Certifications Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          {filtered.map((cert) => (
            <div
              key={cert.id}
              className="bg-white rounded-xl border border-[#dde2e8] p-4 sm:p-6 hover:border-[#dde2e8] transition-colors"
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500 first-cap">Integrity Score</p>
                  <p className={`text-2xl font-bold ${
                    cert.integrity_score >= 90 ? 'text-green-700' :
                    cert.integrity_score >= 70 ? 'text-amber-700' : 'text-red-700'
                  }`}>
                    {cert.integrity_score}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 first-cap">AI Systems</p>
                  <p className="text-2xl font-bold">{cert.ai_systems}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 first-cap">Last Audit</p>
                  <p className="text-sm font-mono">{cert.last_audit}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm border-t border-[#dde2e8] pt-4">
                <div className="text-gray-500">
                  Valid until: <span className="text-[#0e1b2c]">{cert.expires_at}</span>
                </div>
                <div className="flex gap-3">
                  <button className="text-blue-700 hover:text-blue-700">View Details</button>
                  <button className="text-gray-500 hover:text-gray-700">Schedule Audit</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  )
}
