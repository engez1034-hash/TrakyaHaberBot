"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/admin/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          setError(null);
          const result = await signIn("credentials", {
            email,
            password,
            callbackUrl,
            redirect: false
          });
          setLoading(false);
          if (result?.ok && result.url) {
            window.location.href = result.url;
            return;
          }
          setError("Email veya şifre hatalı.");
        }}
        className="w-full max-w-sm rounded-lg border bg-white p-6 shadow"
      >
        <h1 className="mb-4 text-xl font-semibold">Yönetici Girişi</h1>
        <label className="mb-2 block text-sm">E-posta</label>
        <input
          className="mb-3 w-full rounded border px-3 py-2"
          name="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@trakyahaber.com"
        />
        <label className="mb-2 block text-sm">Şifre</label>
        <input
          className="mb-2 w-full rounded border px-3 py-2"
          name="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <p className="mb-2 text-sm text-red-600">{error}</p> : null}
        <button disabled={loading} className="w-full rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-60" type="submit">
          {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
        </button>
        <p className="mt-3 text-xs text-slate-500">
          Giriş sorunu? <Link href="/">Ana sayfaya dön</Link>
        </p>
      </form>
    </main>
  );
}
