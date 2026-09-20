import { cookies } from 'next/headers';
import { verifySession } from './session';

export async function requireCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('gitagent_session')?.value;
  const session = await verifySession(token, process.env.AUTH_SECRET);
  if (!session) throw new Error('UNAUTHENTICATED');
  return session;
}
