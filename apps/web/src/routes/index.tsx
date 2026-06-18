import { createFileRoute, redirect } from '@tanstack/react-router';
import { getSession } from '../server-functions/session';

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await getSession();
    if (session?.user) throw redirect({ to: '/dashboard' });
    throw redirect({ to: '/signin' });
  },
});
