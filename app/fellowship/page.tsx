import { redirect } from 'next/navigation';

// Fellowship moved under Programmes — keep old links working.
export default function FellowshipRedirect() {
  redirect('/programmes/fellowship');
}
