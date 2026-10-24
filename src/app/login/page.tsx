"use client";

import { type FormEvent, useEffect, useState } from "react";

interface SessionUser {
  username: string;
  role: string;
}

export default function LoginPage() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as {
          data?: { authenticated: boolean; user: SessionUser | null };
        };
        if (active && response.ok && body.data?.authenticated) {
          setUser(body.data.user);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = (await response.json()) as {
        data?: { user: SessionUser };
      };
      if (!response.ok || !body.data?.user) {
        setMessage("No fue posible iniciar sesión con esas credenciales.");
        return;
      }
      setUser(body.data.user);
      setMessage("");
    } catch {
      setMessage("No fue posible iniciar sesión con esas credenciales.");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) {
        setMessage("No fue posible cerrar la sesión.");
        return;
      }
      setUser(null);
    } catch {
      setMessage("No fue posible cerrar la sesión.");
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
        Inicia sesión con las credenciales locales del administrador.
      </p>
      {user ? (
        <section className="mt-8 space-y-5 rounded-md border border-slate-200 p-5">
          <p className="text-sm text-slate-700">
            Sesión activa para <strong>{user.username}</strong>.
          </p>
          <button
            className="w-full rounded-md bg-slate-950 px-4 py-2 text-white disabled:opacity-60"
            type="button"
            disabled={loading}
            onClick={handleLogout}
          >
            {loading ? "Cerrando…" : "Cerrar sesión"}
          </button>
        </section>
      ) : (
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-800">
            Usuario
            <input
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2"
              name="username"
              type="text"
              autoComplete="username"
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
      )}
      {message && user ? (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {message}
        </p>
      ) : null}
    </main>
  );
}

