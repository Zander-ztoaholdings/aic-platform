import { redirect } from 'next/navigation';

/** /hq has no page of its own; AIC's business figures are on the staff home. */
export default function HqIndex() {
  redirect('/admin#business');
}
