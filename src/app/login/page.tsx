"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { createBrowserSupabaseClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage("No fue posible iniciar sesión con esas credenciales.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setMessage("La conexión de autenticación no está configurada.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
        Acceso administrativo
      </h1>
      <p className="mt-3 text-slate-600">
        Inicia sesión con una cuenta autorizada de Supabase.
      </p>
      <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-slate-800">
          Correo
          <input
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Contraseña
          <input
            className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button
          className="w-full rounded-md bg-slate-950 px-4 py-2 text-white disabled:opacity-60"
          type="submit"
          disabled={loading}
        >
          {loading ? "Ingresando…" : "Ingresar"}
        </button>
        {message ? (
          <p className="text-sm text-red-700" role="alert">
            {message}
          </p>
        ) : null}
      </form>
    </main>
  );
}

