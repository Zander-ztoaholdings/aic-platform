import type { Metadata } from 'next';
import SignupWizard from './SignupWizard';

export const metadata: Metadata = {
  title: 'Register your organisation — AIC',
  description:
    'Register for AI Integrity Certification. Five short steps: your organisation, the Division it operates in, what is in scope, and the person accountable for it.',
};

export default function SignupPage() {
  return <SignupWizard />;
}
