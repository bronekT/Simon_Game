import { signIn } from "./actions";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-card border border-hairline text-3xl font-bold text-accent">
          C
        </div>
        <h1 className="text-2xl font-semibold">CLOSER</h1>
        <p className="mt-1 text-sm text-muted">AI sales assistant for door pros</p>
      </div>

      <form action={signIn} className="flex flex-col gap-3">
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="Email"
          className="w-full px-3 py-3"
        />
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          className="w-full px-3 py-3"
        />

        {error && <p className="text-sm text-risk">{error}</p>}

        <button
          type="submit"
          className="mt-2 rounded-full bg-accent py-3 font-medium text-bg"
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
