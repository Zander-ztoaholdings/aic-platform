'use client'

import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="w-20 h-20 mx-auto bg-red-500/20 rounded-full flex items-center justify-center mb-6">
            <svg
              className="w-10 h-10 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-aic-paper mb-2">Access Denied</h1>
          <p className="text-gray-400">
            You don&apos;t have permission to access this resource.
          </p>
        </div>

        <div className="bg-aic-paper/5 backdrop-blur-xl rounded-2xl p-6 border border-aic-paper/10 mb-6">
          <h2 className="text-sm font-mono text-gray-400 uppercase tracking-wider mb-4">
            Your Current Role
          </h2>
          <p className="text-aic-paper text-lg">
            Contact your administrator if you believe this is an error.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            href="/"
            className="block w-full py-3 px-4 bg-aic-paper text-black font-semibold rounded-lg hover:bg-gray-100 transition-colors"
          >
            Return to Dashboard
          </Link>
          <Link
            href="/login"
            className="block w-full py-3 px-4 bg-transparent text-aic-paper border border-aic-paper/20 rounded-lg hover:bg-aic-paper/5 transition-colors"
          >
            Sign in with different account
          </Link>
        </div>

        <p className="mt-8 text-sm text-gray-500">
          AIC Platform &bull; Role-Based Access Control
        </p>
      </div>
    </div>
  )
}
