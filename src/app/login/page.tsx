"use client";

import { type FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { logger } from "@/lib/logger";
import styles from "./login.module.css";

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
    <main className={styles.page}>
      <div className={styles.glowLeft} aria-hidden="true" />
      <div className={styles.glowRight} aria-hidden="true" />

      <section className={styles.loginCard} aria-labelledby="login-title">
        <aside className={styles.storyPanel}>
          <div className={styles.ringOne} aria-hidden="true" />
          <div className={styles.ringTwo} aria-hidden="true" />
          <div className={styles.sparkTop} aria-hidden="true">
            ✳
          </div>

          <header className={styles.brand}>
            <span className={styles.brandIcon} aria-hidden="true">
              ♡
            </span>
            <span>
              <strong>Redes de Ayuda</strong>
              <small>Conectando corazones</small>
            </span>
          </header>

          <div className={styles.storyContent}>
            <p className={styles.pill}>
              <span aria-hidden="true" />
              Juntos hacemos la diferencia
            </p>
            <h2>
              Una mano
              <br />
              amiga puede
              <br />
              <em>cambiarlo</em>
              <br />
              todo.
            </h2>
            <p className={styles.storyCopy}>
              Creamos conexiones que transforman vidas. Un espacio donde
              ayudar, compartir y colaborar se convierte en algo
              extraordinario.
            </p>
          </div>

          <div className={styles.communityCards}>
            <div className={styles.communityCard}>
              <div className={styles.avatars} aria-hidden="true">
                <span>☺</span>
                <span>♥</span>
                <span>☀</span>
              </div>
              <strong>La comunidad nos une</strong>
              <small>Cada gesto cuenta.</small>
            </div>
            <div className={styles.hopeCard}>
              <span aria-hidden="true">✦</span>
              <strong>Comparte esperanza</strong>
            </div>
          </div>
          <span className={styles.sparkBottom} aria-hidden="true">
            ✦
          </span>
        </aside>

        <div className={styles.formPanel}>
          <div className={styles.cornerCircle} aria-hidden="true">
            <span />
          </div>
          <div className={styles.formContent}>
            <span className={styles.welcomeIcon} aria-hidden="true">
              ♧
            </span>
            <p className={styles.eyebrow}>Tu comunidad te espera</p>
            <h1 id="login-title">¡Qué bueno tenerte aquí!</h1>
            <p className={styles.intro}>
              Ingresa a tu espacio administrativo y sigue construyendo
              conexiones que generan cambios positivos.
            </p>

            {checkingSession ? (
              <div className={styles.sessionStatus} role="status">
                <span className={styles.spinner} aria-hidden="true" />
                Verificando sesión…
              </div>
            ) : (
              <form className={styles.form} onSubmit={handleSubmit}>
                <label className={styles.field}>
                  <span>Nombre de usuario</span>
                  <span className={styles.inputWrap}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />
                    </svg>
                    <input
                      name="username"
                      type="text"
                      autoComplete="username"
                      placeholder="Escribe tu usuario"
                      required
                    />
                  </span>
                </label>
                <label className={styles.field}>
                  <span>Contraseña</span>
                  <span className={styles.inputWrap}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8 10V8a4 4 0 0 1 8 0v2m-9 0h10v9H7v-9Zm5 4v2" />
                    </svg>
                    <input
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      placeholder="Escribe tu contraseña"
                      required
                    />
                  </span>
                </label>
                <button
                  className={styles.submitButton}
                  type="submit"
                  disabled={loading}
                >
                  <span>{loading ? "Ingresando…" : "Ingresar a mi cuenta"}</span>
                  <span aria-hidden="true">→</span>
                </button>
                {message ? (
                  <p className={styles.errorMessage} role="alert">
                    {message}
                  </p>
                ) : null}
              </form>
            )}

            <footer className={styles.footer}>
              <p>Hecho para conectar personas y crear oportunidades.</p>
              <strong>Redes de Ayuda · Comunidad · Solidaridad</strong>
            </footer>
          </div>
        </div>
      </section>
    </main>
  );
}

