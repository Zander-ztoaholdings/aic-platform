import { redirect } from 'next/navigation';

/**
 * The old HQ front door. It repeated the staff home's figures beside a few of
 * its own, so those few now sit on the staff home (BusinessSection) and the
 * HQ pages are listed in the staff menu. Kept as a redirect for bookmarks.
 */
export default function HqGovernance() {
  redirect('/admin#business');
}
