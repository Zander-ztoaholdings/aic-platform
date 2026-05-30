'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

function BrandMark() {
  return (
    <svg viewBox="0 0 110 180" className="h-16 w-auto flex-shrink-0">
      <path d="M36,1 L1,1 L1,179 L36,179" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"/>
      <path d="M74,1 L109,1 L109,179 L74,179" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="square"/>
      <text x="55" y="20" fontSize="7" fill="#fff" textAnchor="middle" letterSpacing="2.5" fontFamily="Space Grotesk,sans-serif" fontWeight="700">METHODOLOGY</text>
      <text x="55" y="31" fontSize="7" fill="#fff" textAnchor="middle" letterSpacing="2.5" fontFamily="Space Grotesk,sans-serif" fontWeight="700">ASSESSED</text>
      <line x1="8" y1="41" x2="102" y2="41" stroke="#fff" strokeWidth="1" opacity="0.3"/>
      <text x="55" y="100" fontSize="40" fontWeight="700" fill="#fff" textAnchor="middle" letterSpacing="5" fontFamily="Space Grotesk,sans-serif">AIC</text>
      <line x1="8" y1="122" x2="102" y2="122" stroke="#fff" strokeWidth="1" opacity="0.3"/>
      <text x="55" y="148" fontSize="5" fill="#c9920a" textAnchor="middle" letterSpacing="1.5" fontFamily="Space Grotesk,sans-serif" fontWeight="700">AICCERTIFIED.CLOUD</text>
    </svg>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isMfaRequired, setIsMfaRequired] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const mfaToken = formData.get('mfaToken') as string;

    try {
        const result = await signIn('credentials', {
            email,
            password,
            mfaToken,
            redirect: false,
        });

        if (result?.error) {
            if (result.error.includes('MFA_REQUIRED')) {
                setIsMfaRequired(true);
                setError('MFA Token Required');
            } else if (result.error.includes('locked')) {
                setError(result.error);
            } else {
                setError('Invalid credentials or insufficient permissions.');
            }
            setIsLoading(false);
        } else {
            router.push('/');
        }
    } catch {
        setError('A system error occurred. Please try again later.');
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f0f4f8]">
      {/* LEFT PANEL - Dark Navy */}
      <div className="w-full md:w-[45%] bg-[#0a1628] p-8 md:p-16 flex flex-col justify-center relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#c9920a]/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#c9920a]/5 rounded-full blur-3xl -ml-32 -mb-32"></div>
        
        <div className="relative z-10 space-y-8">
          <BrandMark />
          
          <div className="space-y-4">
            <div className="font-mono text-[9px] tracking-[0.3em] text-[#c9920a] uppercase font-bold">
              AIC Pulse
            </div>
            <h1 className="font-serif text-2xl md:text-3xl font-bold text-white leading-tight">
              AI Accountability Platform
            </h1>
            <p className="text-sm text-white/50 max-w-sm leading-relaxed">
              Certifying that human empathy remains in the loop for every consequential automated decision.
            </p>
          </div>

          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#c9920a]"></div>
              <p className="text-[10px] font-mono text-white/70 uppercase tracking-wider">Independent Algorithmic Auditing</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#c9920a]"></div>
              <p className="text-[10px] font-mono text-white/70 uppercase tracking-wider">Real-time Risk Monitoring</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-[#c9920a]"></div>
              <p className="text-[10px] font-mono text-white/70 uppercase tracking-wider">Stakeholder Transparency</p>
            </div>
          </div>
        </div>

        <div className="mt-16 md:absolute md:bottom-12 md:left-16 text-white/20 font-mono text-[10px] tracking-widest uppercase">
          aiccertified.cloud
        </div>
      </div>

      {/* RIGHT PANEL - White Form */}
      <div className="w-full md:w-[55%] flex items-center justify-center p-6 md:p-12">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-[#e5e7eb] rounded-2xl p-8 shadow-sm max-w-sm w-full space-y-8"
        >
          <div className="space-y-1">
            <h2 className="font-serif text-xl font-bold text-[#0f1f3d]">Welcome back</h2>
            <p className="font-mono text-[9px] text-[#9ca3af] uppercase tracking-[0.2em]">
              Meridian Financial Group · Client Portal
            </p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] leading-relaxed"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-6">
            {/* SSO Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => signIn('google', { callbackUrl: '/' })}
                className="flex items-center justify-center gap-2 border border-[#e5e7eb] rounded-xl py-2.5 text-[10px] font-mono font-bold text-[#6b7280] hover:border-[#c9920a] hover:text-[#c9920a] transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1.01.68-2.31 1.08-3.71 1.08-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.16H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.84l3.66-2.75z" />
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.16l3.66 2.75c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                GOOGLE
              </button>
              <button
                type="button"
                onClick={() => signIn('microsoft-entra-id', { callbackUrl: '/' })}
                className="flex items-center justify-center gap-2 border border-[#e5e7eb] rounded-xl py-2.5 text-[10px] font-mono font-bold text-[#6b7280] hover:border-[#c9920a] hover:text-[#c9920a] transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 23 23">
                  <path fill="currentColor" d="M0 0h11v11H0z" />
                  <path fill="currentColor" d="M12 0h11v11H12z" />
                  <path fill="currentColor" d="M0 12h11v11H0z" />
                  <path fill="currentColor" d="M12 12h11v11H12z" />
                </svg>
                OFFICE 365
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[#e5e7eb]"></span>
              </div>
              <div className="relative flex justify-center text-[8px] font-mono font-bold text-[#9ca3af] uppercase tracking-[0.2em]">
                <span className="bg-white px-3">or continue with email</span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="block font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">
                  Institutional Email
                </label>
                <input 
                  id="email" 
                  name="email" 
                  type="email" 
                  required 
                  className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm text-[#0f1f3d] focus:outline-none focus:border-[#c9920a] transition-colors bg-white"
                  placeholder="compliance@meridian.fin"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label htmlFor="password" className="block font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">
                    Access Key
                  </label>
                  <Link 
                    href="/forgot-password" 
                    className="font-mono text-[9px] text-[#9ca3af] hover:text-[#c9920a] transition-colors"
                  >
                    FORGOT?
                  </Link>
                </div>
                <input 
                  id="password" 
                  name="password" 
                  type="password" 
                  required 
                  className="w-full border border-[#e5e7eb] rounded-lg px-3 py-2.5 text-sm text-[#0f1f3d] focus:outline-none focus:border-[#c9920a] transition-colors bg-white"
                  placeholder="••••••••"
                />
              </div>

              <AnimatePresence>
                {isMfaRequired && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2 pt-2"
                  >
                    <label htmlFor="mfaToken" className="block font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#c9920a]">
                      MFA Verification
                    </label>
                    <input 
                      id="mfaToken" 
                      name="mfaToken" 
                      type="text" 
                      required={isMfaRequired}
                      className="w-full border border-[#c9920a]/40 bg-amber-50/30 rounded-lg px-3 py-3 text-lg font-mono tracking-[0.5em] text-center focus:outline-none focus:border-[#c9920a] transition-colors text-[#0f1f3d]"
                      placeholder="000000"
                      maxLength={6}
                      pattern="\d{6}"
                      autoComplete="one-time-code"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-[#c9920a] text-white rounded-full py-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.15em] hover:bg-[#b07d08] transition-colors disabled:opacity-50 mt-4 shadow-sm"
              >
                {isLoading ? 'Authorising…' : 'Access Portal'}
              </button>
            </form>
          </div>

          <div className="text-center">
            <p className="font-mono text-[8px] text-[#9ca3af] uppercase tracking-wider">
              Protected by AIC Secure Auth v2.1<br/>
              Continuous integrity monitoring
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
