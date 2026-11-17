import { redirect } from 'next/navigation';

// The redirect must run at request time. When this page is prerendered the
// stored response carries a 307 status but no `Location` header, which leaves
// visitors staring at an error page at the site root.
export const dynamic = 'force-dynamic';

export default function Home() {
  redirect('/login');
}
