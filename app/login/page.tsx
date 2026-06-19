import { signIn } from "./actions";
import { BrandMark, Wordmark } from "@/components/Brand";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      {/* ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full bg-accent/20 blur-3xl" />

      <div className="relative mb-8 flex flex-col items-center text-center">
        <BrandMark size={84} className="animate-float drop-shadow-[0_8px_30px_rgba(233,162,59,0.4)]" />
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">
          <Wordmark />
        </h1>
        <p className="mt-1.5 text-sm text-muted">AI sales assistant for door pros</p>
      </div>

      <form action={signIn} className="glass relative flex flex-col gap-3 rounded-card p-5">
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Email"
          className="w-full px-3.5 py-3"
        />
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          className="w-full px-3.5 py-3"
        />

        {error && <p className="text-sm text-risk">{error}</p>}

        <button
          type="submit"
          className="mt-1 rounded-full bg-accent-grad py-3.5 font-semibold text-bg shadow-[0_8px_24px_-8px_rgba(233,162,59,0.6)] transition active:scale-[0.98]"
        >
          Sign in
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-muted">
        Create your single user in the Supabase dashboard
        (Authentication → Users) — see README.md.
      </p>
    </main>
  );
}
