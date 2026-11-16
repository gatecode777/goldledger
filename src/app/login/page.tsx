import { signIn } from '@/auth';
import { redirect } from 'next/navigation';
import LoginPageClient from './LoginPageClient';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl ?? '/';

  async function loginAction(formData: FormData) {
    'use server';
    const email    = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      await signIn('credentials', {
        email,
        password,
        redirectTo: callbackUrl,
      });
    } catch (err) {
      // signIn throws a NEXT_REDIRECT for successful login
      // and an AuthError for failed login
      const isNextRedirect =
        typeof err === 'object' &&
        err !== null &&
        'digest' in err &&
        typeof (err as { digest: string }).digest === 'string' &&
        (err as { digest: string }).digest.startsWith('NEXT_REDIRECT');

      if (isNextRedirect) {
        // Successful login → let Next.js handle the redirect
        throw err;
      }

      console.error('[loginAction auth error]:', err);

      // Failed login → redirect to login with error flag
      redirect(`/login?error=invalid&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
  }

  return (
    <LoginPageClient
      action={loginAction}
      error={params.error}
    />
  );
}
