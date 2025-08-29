// app/page.tsx
// StoryGrind Main Interface - Next.js version with Fast Init
// https://storygrind.onrender.com

export const revalidate = 0;
export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { fastInitForUser } from './lib/drive/fastInitServer';
import ClientBoot from '@/components/ClientBoot';

export default async function StoryGrindHome() {
  const session = await getServerSession(authOptions);
  
  if (!session?.accessToken) {
    // Let ClientBoot handle the sign-in UI
    return <ClientBoot init={null} />;
  }

  // Fast parallel initialization on server
  const init = await fastInitForUser(session.accessToken as string);
  
  return <ClientBoot init={init} />;
}