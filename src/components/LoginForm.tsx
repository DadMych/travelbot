"use client";

import { useState } from "react";
import { Loader2, Lock, MapPin } from "lucide-react";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      window.location.href = "/";
      return;
    }

    setError("Неверный пароль");
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#111827_0%,_#070b14_60%)] p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/8 bg-card/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/15 ring-1 ring-accent/30">
            <MapPin className="h-7 w-7 text-accent" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Travel Map</h1>
          <p className="text-center text-sm text-muted">Личная карта путешествий</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              className="w-full rounded-xl border border-white/8 bg-white/4 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
              autoFocus
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading || !password}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent py-3 text-sm font-medium text-white transition hover:bg-accent/90 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Войти
          </button>
        </form>
      </div>
    </div>
  );
}
