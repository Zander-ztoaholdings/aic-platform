"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowLeft, Check, Pencil, Loader2 } from "lucide-react";
import {
  DIVISIONS,
  COUNTRIES,
  SECTORS,
  SIZE_BANDS,
  AI_SYSTEM_BANDS,
  TRI_STATE,
  REFERRAL_SOURCES,
} from "./signup-options";

/* ─────────────────────────────────────────────────────────────────────────
   Registration, as five short screens instead of one long form.

   The old page put the Division decision and the password field on the same
   screen, which asked someone to choose the mode of operation their entire
   requirement set derives from while they were half-way through typing an
   email address. Splitting it lets each question have the room it needs, and
   lets the form ask considerably more than it used to without reading as a
   wall — every organisation now arrives with its jurisdiction, sector, size,
   AI footprint and Section 71 position on the record from day one.

   Division no longer has a default. It used to arrive pre-set to 02, which is
   a strange thing for a certification body to do: the Division decides which
   of the 44 published requirements apply, so a silent default is a silent
   assumption about somebody else's business.
   ───────────────────────────────────────────────────────────────────────── */

const STEPS = [
  { key: "org", label: "Organisation", blurb: "Who is being certified." },
  { key: "division", label: "Division", blurb: "How decisions are actually made." },
  { key: "ai", label: "AI footprint", blurb: "What is in scope, and who it touches." },
  { key: "account", label: "Your account", blurb: "The person accountable for this." },
  { key: "review", label: "Review", blurb: "Confirm before anything is created." },
] as const;

interface FormState {
  orgName: string;
  legalName: string;
  registrationNumber: string;
  website: string;
  country: string;
  sector: string;
  sizeBand: string;
  division: number | null;
  aiSystemsBand: string;
  affectsIndividuals: string;
  solelyAutomated: string;
  name: string;
  jobTitle: string;
  email: string;
  password: string;
  confirmPassword: string;
  isAccountablePerson: boolean;
  referralSource: string;
  declaration: boolean;
}

const INITIAL: FormState = {
  orgName: "",
  legalName: "",
  registrationNumber: "",
  website: "",
  country: "South Africa",
  sector: "",
  sizeBand: "",
  division: null,
  aiSystemsBand: "",
  affectsIndividuals: "",
  solelyAutomated: "",
  name: "",
  jobTitle: "",
  email: "",
  password: "",
  confirmPassword: "",
  isAccountablePerson: true,
  referralSource: "",
  declaration: false,
};

/* ── Motion ──────────────────────────────────────────────────────────────
   One spring, used everywhere, so the whole page settles the same way.   */
const SPRING = { type: "spring", stiffness: 380, damping: 34, mass: 0.9 } as const;

const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 26 : -26, scale: 0.99 }),
  center: { opacity: 1, x: 0, scale: 1 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -26 : 26, scale: 0.99 }),
};

const listVariants = {
  center: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
};

const itemVariants = {
  enter: { opacity: 0, y: 8 },
  center: { opacity: 1, y: 0 },
};

/* ── Small pieces ────────────────────────────────────────────────────── */

function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const text = (
    <>
      {label}
      {hint && <span className="text-[#b6bdc9] font-normal"> · {hint}</span>}
    </>
  );
  const cls = "block text-[11px] font-medium text-[#8a93a3] mb-1.5 tracking-wide";
  return (
    <motion.div variants={itemVariants} className="min-w-0">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={cls}>
          {text}
        </label>
      ) : (
        <span className={cls}>{text}</span>
      )}
      {children}
    </motion.div>
  );
}

const inputClass =
  "w-full rounded-2xl bg-[#fafbfc] border border-[#0a1728]/[0.07] px-4 py-3 text-sm text-[#0A1728] " +
  "placeholder:text-[#b6bdc9] outline-none transition-all duration-200 " +
  "focus:bg-white focus:border-[#c9920a]/60 focus:ring-4 focus:ring-[#c9920a]/[0.10]";

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputClass} />;
}

function SelectInput({
  id,
  value,
  onChange,
  options,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} appearance-none pr-10 ${value ? "" : "text-[#b6bdc9]"}`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o} className="text-[#0A1728]">
            {o}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#b6bdc9]"
        viewBox="0 0 12 12"
        fill="none"
      >
        <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** A row of soft pills — used wherever the answer set is short enough to see at once. */
function PillGroup({
  options,
  value,
  onChange,
  name,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o;
        return (
          <motion.button
            key={o}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o)}
            whileTap={{ scale: 0.97 }}
            transition={SPRING}
            className={`relative px-4 py-2.5 rounded-full text-[13px] transition-colors duration-200 border ${
              active
                ? "border-[#c9920a]/40 text-[#0A1728] font-medium"
                : "border-[#0a1728]/[0.08] text-[#6b7280] hover:border-[#0a1728]/[0.16] hover:text-[#0A1728]"
            }`}
          >
            {active && (
              <motion.span
                layoutId={`pill-${name}`}
                className="absolute inset-0 rounded-full bg-[#c9920a]/[0.07]"
                transition={SPRING}
              />
            )}
            <span className="relative">{o}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

/* ── The wizard ──────────────────────────────────────────────────────── */

export default function SignupWizard() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const division = useMemo(
    () => DIVISIONS.find((d) => d.value === form.division) ?? null,
    [form.division]
  );

  const passwordScore = useMemo(() => {
    const p = form.password;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 8) s++;
    if (p.length >= 12) s++;
    if (/[^A-Za-z0-9]/.test(p) || (/[A-Z]/.test(p) && /[0-9]/.test(p))) s++;
    return s;
  }, [form.password]);

  /** What this step still needs, in the words the person will read. */
  function validate(i: number): string | null {
    if (i === 0) {
      if (form.orgName.trim().length < 2) return "Your organisation needs a name.";
      if (!form.country) return "Choose the jurisdiction you operate in.";
      if (!form.sector) return "Choose the sector you operate in.";
      if (!form.sizeBand) return "Choose roughly how many people work there.";
      return null;
    }
    if (i === 1) {
      if (form.division === null) return "Choose the Division that describes how decisions are made.";
      return null;
    }
    if (i === 2) {
      if (!form.aiSystemsBand) return "Tell us roughly how many systems are in scope.";
      if (!form.affectsIndividuals) return "Answer whether those decisions affect individuals.";
      if (!form.solelyAutomated) return "Answer whether any decision is made without a human.";
      return null;
    }
    if (i === 3) {
      if (form.name.trim().length < 2) return "Your full name, please.";
      if (form.jobTitle.trim().length < 2) return "Your role — a certificate names a person, not a mailbox.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "That email address does not look right.";
      if (form.password.length < 8) return "Passwords need at least 8 characters.";
      if (form.password !== form.confirmPassword) return "The two passwords do not match.";
      return null;
    }
    if (i === 4) {
      if (!form.declaration) return "Please confirm the details are accurate.";
      return null;
    }
    return null;
  }

  function go(next: number) {
    if (next > step) {
      const problem = validate(step);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setError("");
    setDirection(next > step ? 1 : -1);
    setStep(next);
  }

  async function submit() {
    const problem = validate(4);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName: form.orgName.trim(),
          division: form.division,
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          profile: {
            legalName: form.legalName.trim() || null,
            registrationNumber: form.registrationNumber.trim() || null,
            website: form.website.trim() || null,
            country: form.country || null,
            sector: form.sector || null,
            sizeBand: form.sizeBand || null,
            aiSystemsBand: form.aiSystemsBand || null,
            affectsIndividuals: form.affectsIndividuals || null,
            solelyAutomated: form.solelyAutomated || null,
            referralSource: form.referralSource || null,
            jobTitle: form.jobTitle.trim() || null,
            isAccountablePerson: form.isAccountablePerson,
          },
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.message || data?.error || "Registration failed.");
        setLoading(false);
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login?registered=true"), 1100);
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  const progress = ((step + (done ? 1 : 0)) / STEPS.length) * 100;

  return (
    <div className="min-h-screen w-full relative overflow-hidden bg-[linear-gradient(180deg,#fbfcfd_0%,#f2f4f8_100%)]">
      {/* A whisper of gold, top-right. The brand is a touch here, not a theme. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60rem 40rem at 88% -10%, rgba(201,146,10,0.07), transparent 60%), radial-gradient(50rem 32rem at 5% 105%, rgba(10,23,40,0.05), transparent 65%)",
        }}
      />

      <div className="relative z-10 min-h-screen flex flex-col items-center px-4 py-10 sm:py-14">
        {/* Wordmark */}
        <Link href="/" className="mb-8 sm:mb-10 group">
          <span className="font-serif text-[22px] font-bold text-[#0A1728] tracking-tight">AIC</span>
          <span className="text-[#c9920a] font-serif text-[22px] font-bold">.</span>
        </Link>

        <motion.div
          layout={!reduceMotion}
          transition={{ layout: { type: "spring", stiffness: 300, damping: 34 } }}
          className="w-full max-w-[600px] bg-white rounded-[28px] border border-[#0a1728]/[0.05] overflow-hidden"
          style={{ boxShadow: "0 1px 3px rgba(10,23,40,0.04), 0 16px 48px -16px rgba(10,23,40,0.12)" }}
        >
          {/* Progress */}
          <div className="h-[3px] bg-[#0a1728]/[0.05]">
            <motion.div
              className="h-full bg-[#c9920a] rounded-r-full"
              animate={{ width: `${progress}%` }}
              transition={reduceMotion ? { duration: 0 } : SPRING}
            />
          </div>

          <div className="px-6 sm:px-10 pt-8 sm:pt-9 pb-7 sm:pb-8">
            <AnimatePresence mode="wait" custom={direction} initial={false}>
              {done ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={SPRING}
                  className="py-10 text-center"
                >
                  <motion.div
                    className="w-14 h-14 rounded-full bg-[#c9920a]/10 flex items-center justify-center mx-auto mb-5"
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ ...SPRING, delay: 0.05 }}
                  >
                    <motion.svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                      <motion.path
                        d="M6 13.5L11 18.5L20 8"
                        stroke="#c9920a"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.45, ease: "easeOut", delay: 0.15 }}
                      />
                    </motion.svg>
                  </motion.div>
                  <h2 className="font-serif text-2xl font-bold text-[#0A1728] mb-2">
                    {form.orgName} is registered
                  </h2>
                  <p className="text-sm text-[#6b7280]">
                    Taking you to sign in — your requirement set is already waiting.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key={step}
                  custom={direction}
                  variants={reduceMotion ? undefined : stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={SPRING}
                >
                  {/* Step header */}
                  <div className="mb-7">
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#c9920a] font-semibold">
                        Step {step + 1}
                      </span>
                      <span className="text-[#dde1e8]">/</span>
                      <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#b6bdc9]">
                        {STEPS.length}
                      </span>
                    </div>
                    <h1 className="font-serif text-[26px] sm:text-[28px] leading-tight font-bold text-[#0A1728] mb-1.5">
                      {stepTitle(step, form)}
                    </h1>
                    <p className="text-sm text-[#6b7280] leading-relaxed">{stepBlurb(step)}</p>
                  </div>

                  <motion.div variants={reduceMotion ? undefined : listVariants} initial="enter" animate="center">
                    {step === 0 && (
                      <div className="space-y-4">
                        <Field label="Trading name" htmlFor="su-org">
                          <TextInput
                            autoFocus
                            id="su-org"
                            value={form.orgName}
                            onChange={(e) => set("orgName", e.target.value)}
                            placeholder="What people call you"
                          />
                        </Field>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <Field label="Registered legal name" hint="if different" htmlFor="su-legal">
                            <TextInput
                              id="su-legal"
                            value={form.legalName}
                              onChange={(e) => set("legalName", e.target.value)}
                              placeholder="As registered"
                            />
                          </Field>
                          <Field label="Registration number" hint="optional" htmlFor="su-reg">
                            <TextInput
                              id="su-reg"
                            value={form.registrationNumber}
                              onChange={(e) => set("registrationNumber", e.target.value)}
                              placeholder="2019/123456/07"
                            />
                          </Field>
                        </div>
                        <Field label="Website" hint="optional" htmlFor="su-web">
                          <TextInput
                            id="su-web"
                            value={form.website}
                            onChange={(e) => set("website", e.target.value)}
                            placeholder="example.co.za"
                          />
                        </Field>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <Field label="Jurisdiction" htmlFor="su-country">
                            <SelectInput
                              id="su-country"
                              value={form.country}
                              onChange={(v) => set("country", v)}
                              options={COUNTRIES}
                              placeholder="Select a country"
                            />
                          </Field>
                          <Field label="Sector" htmlFor="su-sector">
                            <SelectInput
                              id="su-sector"
                              value={form.sector}
                              onChange={(v) => set("sector", v)}
                              options={SECTORS}
                              placeholder="Select a sector"
                            />
                          </Field>
                        </div>
                        <Field label="Size">
                          <PillGroup
                            name="size"
                            options={SIZE_BANDS}
                            value={form.sizeBand}
                            onChange={(v) => set("sizeBand", v)}
                          />
                        </Field>
                      </div>
                    )}

                    {step === 1 && (
                      <div className="space-y-2">
                        {DIVISIONS.map((d) => {
                          const active = form.division === d.value;
                          return (
                            <motion.button
                              key={d.value}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              variants={itemVariants}
                              onClick={() => set("division", d.value)}
                              whileHover={{ y: -1 }}
                              whileTap={{ scale: 0.995 }}
                              transition={SPRING}
                              className={`relative w-full text-left rounded-2xl px-5 py-4 border transition-colors duration-200 ${
                                active
                                  ? "border-[#c9920a]/45"
                                  : "border-[#0a1728]/[0.07] hover:border-[#0a1728]/[0.16]"
                              }`}
                            >
                              {active && (
                                <motion.span
                                  layoutId="division-active"
                                  className="absolute inset-0 rounded-2xl bg-[#c9920a]/[0.06]"
                                  transition={SPRING}
                                />
                              )}
                              <span className="relative flex gap-4 items-start">
                                <span
                                  className={`font-mono text-[11px] pt-0.5 shrink-0 ${
                                    active ? "text-[#c9920a]" : "text-[#b6bdc9]"
                                  }`}
                                >
                                  0{d.value}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-2">
                                    <span className="font-serif text-[15px] font-bold text-[#0A1728]">
                                      {d.label}
                                    </span>
                                    <span className="text-[13px] text-[#6b7280]">{d.tagline}</span>
                                  </span>
                                  <span className="block text-[12.5px] text-[#8a93a3] leading-relaxed mt-1">
                                    {d.who}
                                  </span>
                                </span>
                                <span
                                  className={`w-[18px] h-[18px] rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                    active ? "border-[#c9920a] bg-[#c9920a]" : "border-[#0a1728]/15"
                                  }`}
                                >
                                  {active && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                </span>
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}

                    {step === 2 && (
                      <div className="space-y-6">
                        <Field label="Automated or AI-assisted systems in scope">
                          <PillGroup
                            name="systems"
                            options={AI_SYSTEM_BANDS}
                            value={form.aiSystemsBand}
                            onChange={(v) => set("aiSystemsBand", v)}
                          />
                        </Field>
                        <Field label="Do those decisions affect individuals — customers, patients, applicants, staff?">
                          <PillGroup
                            name="affects"
                            options={TRI_STATE}
                            value={form.affectsIndividuals}
                            onChange={(v) => set("affectsIndividuals", v)}
                          />
                        </Field>
                        <Field label="Is any such decision made solely by automated means, with no human involved?">
                          <PillGroup
                            name="solely"
                            options={TRI_STATE}
                            value={form.solelyAutomated}
                            onChange={(v) => set("solelyAutomated", v)}
                          />
                        </Field>
                        <motion.p
                          variants={itemVariants}
                          className="text-[12.5px] text-[#8a93a3] leading-relaxed border-l-2 border-[#c9920a]/30 pl-3.5"
                        >
                          Those last two are the conditions Section 71 of POPIA turns on. Answering
                          them here is not a commitment — it is the starting position your assessment
                          works from, and “not sure” is a legitimate answer.
                        </motion.p>
                      </div>
                    )}

                    {step === 3 && (
                      <div className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                          <Field label="Full name" htmlFor="su-name">
                            <TextInput
                              autoFocus
                              id="su-name"
                            value={form.name}
                              onChange={(e) => set("name", e.target.value)}
                              placeholder="Your name"
                            />
                          </Field>
                          <Field label="Role" htmlFor="su-role">
                            <TextInput
                              id="su-role"
                            value={form.jobTitle}
                              onChange={(e) => set("jobTitle", e.target.value)}
                              placeholder="e.g. Head of Risk"
                            />
                          </Field>
                        </div>
                        <Field label="Work email" htmlFor="su-email">
                          <TextInput
                            type="email"
                            id="su-email"
                            value={form.email}
                            onChange={(e) => set("email", e.target.value)}
                            placeholder="you@company.co.za"
                          />
                        </Field>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <Field label="Password" hint="8 characters minimum" htmlFor="su-pass">
                            <TextInput
                              type="password"
                              id="su-pass"
                            value={form.password}
                              onChange={(e) => set("password", e.target.value)}
                              placeholder="Choose a password"
                            />
                          </Field>
                          <Field label="Confirm password" htmlFor="su-confirm">
                            <TextInput
                              type="password"
                              id="su-confirm"
                            value={form.confirmPassword}
                              onChange={(e) => set("confirmPassword", e.target.value)}
                              placeholder="Type it again"
                            />
                          </Field>
                        </div>

                        {form.password.length > 0 && (
                          <div className="flex gap-1.5 pt-0.5">
                            {[0, 1, 2].map((i) => (
                              <motion.div
                                key={i}
                                className="h-[3px] flex-1 rounded-full bg-[#0a1728]/[0.07] overflow-hidden"
                              >
                                <motion.div
                                  className="h-full bg-[#c9920a] origin-left"
                                  initial={{ scaleX: 0 }}
                                  animate={{ scaleX: passwordScore > i ? 1 : 0 }}
                                  transition={SPRING}
                                />
                              </motion.div>
                            ))}
                          </div>
                        )}

                        <Field label="How did you hear about AIC?" hint="optional" htmlFor="su-referral">
                          <SelectInput
                            id="su-referral"
                            value={form.referralSource}
                            onChange={(v) => set("referralSource", v)}
                            options={REFERRAL_SOURCES}
                            placeholder="Select one"
                          />
                        </Field>

                        <motion.label
                          variants={itemVariants}
                          className="flex items-start gap-3 cursor-pointer pt-1 group"
                        >
                          <span
                            className={`mt-0.5 w-[18px] h-[18px] rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                              form.isAccountablePerson
                                ? "bg-[#c9920a] border-[#c9920a]"
                                : "border-[#0a1728]/15 group-hover:border-[#0a1728]/30"
                            }`}
                          >
                            {form.isAccountablePerson && (
                              <Check className="w-3 h-3 text-white" strokeWidth={3} />
                            )}
                          </span>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={form.isAccountablePerson}
                            onChange={(e) => set("isAccountablePerson", e.target.checked)}
                          />
                          <span className="text-[13px] text-[#6b7280] leading-relaxed">
                            I am the named individual accountable for automated decisions here. If
                            that is someone else, leave this unticked — you can name them once you
                            are inside.
                          </span>
                        </motion.label>
                      </div>
                    )}

                    {step === 4 && (
                      <div className="space-y-1">
                        <Summary label="Organisation" value={form.orgName} onEdit={() => go(0)} />
                        {form.legalName && <Summary label="Registered as" value={form.legalName} onEdit={() => go(0)} />}
                        {form.registrationNumber && (
                          <Summary label="Registration no." value={form.registrationNumber} onEdit={() => go(0)} />
                        )}
                        {form.website && <Summary label="Website" value={form.website} onEdit={() => go(0)} />}
                        <Summary label="Jurisdiction" value={form.country} onEdit={() => go(0)} />
                        <Summary label="Sector" value={form.sector} onEdit={() => go(0)} />
                        <Summary label="Size" value={form.sizeBand} onEdit={() => go(0)} />
                        <Summary
                          label="Division"
                          value={division ? `0${division.value} · ${division.label}` : "—"}
                          onEdit={() => go(1)}
                        />
                        <Summary label="Systems in scope" value={form.aiSystemsBand} onEdit={() => go(2)} />
                        <Summary label="Affects individuals" value={form.affectsIndividuals} onEdit={() => go(2)} />
                        <Summary label="Solely automated" value={form.solelyAutomated} onEdit={() => go(2)} />
                        <Summary
                          label="Administrator"
                          value={`${form.name} · ${form.jobTitle}`}
                          onEdit={() => go(3)}
                        />
                        <Summary label="Email" value={form.email} onEdit={() => go(3)} />

                        <motion.label
                          variants={itemVariants}
                          className="flex items-start gap-3 cursor-pointer pt-5 group"
                        >
                          <span
                            className={`mt-0.5 w-[18px] h-[18px] rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                              form.declaration
                                ? "bg-[#c9920a] border-[#c9920a]"
                                : "border-[#0a1728]/15 group-hover:border-[#0a1728]/30"
                            }`}
                          >
                            {form.declaration && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                          </span>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={form.declaration}
                            onChange={(e) => set("declaration", e.target.checked)}
                          />
                          <span className="text-[13px] text-[#6b7280] leading-relaxed">
                            These details are accurate to the best of my knowledge. I understand the
                            Division I have chosen decides which of the published requirements this
                            organisation will be assessed against.
                          </span>
                        </motion.label>
                      </div>
                    )}
                  </motion.div>

                  {/* Error */}
                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -4, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={SPRING}
                        className="text-[13px] text-[#c0392b] mt-5"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {/* Nav */}
                  <div className="flex items-center gap-3 mt-8">
                    {step > 0 && (
                      <motion.button
                        type="button"
                        onClick={() => go(step - 1)}
                        whileTap={{ scale: 0.97 }}
                        transition={SPRING}
                        className="inline-flex items-center gap-1.5 text-[13px] text-[#8a93a3] hover:text-[#0A1728] transition-colors px-2 py-3"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> Back
                      </motion.button>
                    )}
                    <motion.button
                      type="button"
                      onClick={() => (step === STEPS.length - 1 ? submit() : go(step + 1))}
                      disabled={loading}
                      whileHover={loading ? undefined : { y: -1 }}
                      whileTap={loading ? undefined : { scale: 0.99 }}
                      transition={SPRING}
                      className="ml-auto inline-flex items-center justify-center gap-2 bg-[#0A1728] text-white rounded-full px-7 py-3.5 text-[13px] font-semibold disabled:opacity-55 transition-colors hover:bg-[#12243c]"
                      style={{ boxShadow: "0 6px 20px -8px rgba(10,23,40,0.5)" }}
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Creating
                        </>
                      ) : step === STEPS.length - 1 ? (
                        <>
                          Create the account <ArrowRight className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          Continue <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {!done && (
          <p className="text-[13px] text-[#8a93a3] mt-7">
            Already registered?{" "}
            <Link href="/login" className="text-[#0A1728] font-medium hover:text-[#c9920a] transition-colors">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

function Summary({
  label,
  value,
  onEdit,
}: {
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <motion.div
      variants={itemVariants}
      className="flex items-baseline gap-4 py-2.5 border-b border-[#0a1728]/[0.05] last:border-0 group"
    >
      <span className="text-[11px] text-[#b6bdc9] w-[130px] shrink-0 tracking-wide">{label}</span>
      <span className="text-[13.5px] text-[#0A1728] flex-1 min-w-0 truncate">{value || "—"}</span>
      <button
        type="button"
        onClick={onEdit}
        className="text-[#c9920a] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-1"
        aria-label={`Edit ${label}`}
      >
        <Pencil className="w-3 h-3" />
      </button>
    </motion.div>
  );
}

function stepTitle(step: number, form: FormState) {
  switch (step) {
    case 0:
      return "Register your organisation";
    case 1:
      return "How are consequential decisions made?";
    case 2:
      return "What is in scope";
    case 3:
      return "Your account";
    default:
      return form.orgName ? `Confirm ${form.orgName}` : "Confirm the details";
  }
}

function stepBlurb(step: number) {
  return STEPS[step].blurb;
}
