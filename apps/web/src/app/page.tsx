import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';

export default async function HomePage() {
  redirect((await currentUser()) ? '/tasks' : '/signin');
}
