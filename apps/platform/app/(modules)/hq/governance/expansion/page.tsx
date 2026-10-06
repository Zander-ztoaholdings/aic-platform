import { redirect } from 'next/navigation';

/** Replaced by the Markets tracker, which keeps each market's stage, owner, next step and history. */
export default function Moved() {
  redirect('/hq/markets');
}
