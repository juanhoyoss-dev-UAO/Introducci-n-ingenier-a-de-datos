"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { logger } from "@/lib/logger";

interface SessionUser {
  username: string;
  role: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let active = true;
    logger.info("UI", "navigation", { destination: "/login" });
    fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as {
          data?: { authenticated: boolean; user: SessionUser | null };
        };
        if (
          active &&
          response.ok &&
          body.data?.authenticated &&
          body.data.user?.role === "admin"
        ) {
          logger.ok("UI", "session_detected");
          router.replace("/dashboard");
          router.refresh();
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setCheckingSession(false);
        }
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "");
    const password = String(form.get("password") ?? "");
    logger.info("UI", "login_started");

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
        logger.warn("UI", "login_rejected", { status: response.status });
        return;
      }
      setMessage("");
      logger.ok("UI", "login_completed");
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setMessage("No fue posible iniciar sesión con esas credenciales.");
      logger.error("UI", "login_error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-16">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
          Redes de Ayuda
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          Acceso administrativo
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Inicia sesión con las credenciales locales configuradas para el
          administrador.
        </p>
        {checkingSession ? (
          <p className="mt-8 text-sm text-slate-500" role="status">
            Verificando sesión…
          </p>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-slate-800">
              Usuario
              <input
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                name="username"
                type="text"
                autoComplete="username"
                required
              />
            </label>
            <label className="block text-sm font-medium text-slate-800">
              Contraseña
              <input
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button
              className="w-full rounded-lg bg-slate-950 px-4 py-2.5 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
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
      </section>
    </main>
  );
}

