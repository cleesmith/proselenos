// app/page.tsx
// Proselenos Main Interface - Next.js version with Fast Init
// https://proselenos.onrender.com

export const revalidate = 0;
export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { fastInitForUser } from './lib/drive/fastInitServer';
import ClientBoot from '@/components/ClientBoot';

export default async function proselenosHome() {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) { 
    console.log('>>> user email=', session.user.email);
  }

  if (!session?.accessToken) {
    // Let ClientBoot handle the sign-in UI
    return <ClientBoot init={null} />;
  }

  // Fast parallel initialization on server
  const init = await fastInitForUser(session.accessToken as string);
  
  return <ClientBoot init={init} />;
}