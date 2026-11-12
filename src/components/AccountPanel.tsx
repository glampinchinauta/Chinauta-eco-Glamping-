import React, { useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

interface MyReservation {
  reservation_code: string;
  dome_name: string;
  check_in: string;
  check_out: string;
  guests: number;
  status: string;
  payment_status: string;
  total_amount: number;
  amount_paid: number;
  amount_pending: number;
}

const AUTH_ERRORS: Record<string, string> = {
  'auth/invalid-email': 'El correo no es válido.',
  'auth/missing-password': 'Escribe tu contraseña.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/user-not-found': 'Correo o contraseña incorrectos.',
  'auth/email-already-in-use': 'Ya existe una cuenta con ese correo. Inicia sesión.',
  'auth/weak-password': 'La contraseña debe tener al menos 8 caracteres.',
  'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  'auth/network-request-failed': 'No hay conexión. Revisa tu internet e inténtalo de nuevo.',
};

function errorText(err: any): string {
  return AUTH_ERRORS[err?.code] || 'No pudimos completar la acción. Inténtalo de nuevo.';
}

const cop = (n: number) => `$${Number(n || 0).toLocaleString('es-CO')} COP`;

export const AccountPanel: React.FC = () => {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [ready, setReady] = useState(false);
  const [, setRevision] = useState(0);

  useEffect(() => onAuthStateChanged(auth, (u) => { setUser(u); setReady(true); }), []);

  if (!ready) return null;
  if (!user) return <AuthForms />;
  // user.reload() updates the same User object without firing onAuthStateChanged, so re-render explicitly.
  if (!user.emailVerified) return <VerifyEmail user={user} onConfirmed={() => setRevision((n) => n + 1)} />;
  return <MyAccount user={user} />;
};

const AuthForms: React.FC = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await sendEmailVerification(cred.user);
        setMessage('Te enviamos un correo para confirmar tu cuenta. Ábrelo y vuelve aquí.');
      }
      setIsError(false);
    } catch (err: any) {
      setIsError(true);
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!email.trim()) {
      setIsError(true);
      setMessage('Escribe tu correo para enviarte el enlace de recuperación.');
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setIsError(false);
      setMessage('Si el correo está registrado, te enviamos un enlace para cambiar tu contraseña.');
    } catch (err: any) {
      setIsError(true);
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="account-title" className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h4 id="account-title" className="text-base font-bold text-slate-900">
          {mode === 'login' ? 'Entra a tu cuenta' : 'Crea tu cuenta'}
        </h4>
        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage(''); }}
          className="text-xs font-semibold text-emerald-800 underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
        >
          {mode === 'login' ? '¿No tienes cuenta? Regístrate' : 'Ya tengo cuenta'}
        </button>
      </div>
      <p className="text-xs text-slate-600">
        Con tu cuenta verás todas tus reservas, incluidas las que hiciste antes de crearla con el mismo correo.
      </p>

      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2" noValidate>
        <label className="block text-xs font-semibold text-slate-800 sm:col-span-2">
          Correo electrónico
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-800 sm:col-span-2">
          Contraseña {mode === 'register' && <span className="font-normal text-slate-600">(mínimo 8 caracteres)</span>}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={mode === 'register' ? 8 : undefined}
            required
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          />
        </label>
        <div className="sm:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
          >
            {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
          {mode === 'login' && (
            <button
              type="button"
              onClick={resetPassword}
              disabled={busy}
              className="text-xs font-semibold text-emerald-800 underline underline-offset-2 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded"
            >
              Olvidé mi contraseña
            </button>
          )}
        </div>
      </form>

      {message && (
        <p role="status" aria-live="polite" className={`text-sm font-semibold ${isError ? 'text-rose-800' : 'text-emerald-800'}`}>
          {message}
        </p>
      )}
    </section>
  );
};

const VerifyEmail: React.FC<{ user: User; onConfirmed: () => void }> = ({ user, onConfirmed }) => {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    try {
      await user.reload();
      if (user.emailVerified) onConfirmed();
      else setMessage('Aún no vemos la confirmación. Abre el enlace del correo y vuelve a intentar.');
    } catch (err: any) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    try {
      await sendEmailVerification(user);
      setMessage('Te reenviamos el correo de confirmación.');
    } catch (err: any) {
      setMessage(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="verify-title" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-3">
      <h4 id="verify-title" className="text-base font-bold text-amber-900">Confirma tu correo</h4>
      <p className="text-sm text-amber-900">
        Enviamos un enlace a <strong>{user.email}</strong>. Confírmalo para ver tus reservas.
      </p>
      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={refresh} disabled={busy} className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
          Ya confirmé mi correo
        </button>
        <button type="button" onClick={resend} disabled={busy} className="rounded-lg border border-amber-800 px-4 py-2 text-sm font-semibold text-amber-900 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
          Reenviar correo
        </button>
        <button type="button" onClick={() => signOut(auth)} className="text-sm font-semibold text-amber-900 underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded">
          Cerrar sesión
        </button>
      </div>
      {message && <p role="status" aria-live="polite" className="text-sm text-amber-900">{message}</p>}
    </section>
  );
};

const MyAccount: React.FC<{ user: User }> = ({ user }) => {
  const [reservations, setReservations] = useState<MyReservation[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch('/api/my/reservations', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'No pudimos cargar tus reservas.');
        if (!cancelled) setReservations(data);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'No pudimos cargar tus reservas.');
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <section aria-labelledby="my-account-title" className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 id="my-account-title" className="text-base font-bold text-slate-900">Mis reservas</h4>
          <p className="text-xs text-slate-600">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => signOut(auth)}
          className="rounded-lg border border-slate-400 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          Cerrar sesión
        </button>
      </div>

      {error && <p role="alert" className="text-sm font-semibold text-rose-800">{error}</p>}
      {!error && reservations === null && <p className="text-sm text-slate-600">Cargando tus reservas…</p>}
      {reservations && reservations.length === 0 && (
        <p className="text-sm text-slate-700">Todavía no tienes reservas con este correo.</p>
      )}
      {reservations && reservations.length > 0 && (
        <ul className="space-y-3">
          {reservations.map((r) => (
            <li key={r.reservation_code} className="rounded-xl border border-slate-200 p-4 text-sm text-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono font-bold text-emerald-800">{r.reservation_code}</span>
                <span className="text-xs font-semibold">{r.status}</span>
              </div>
              <p className="mt-1">{r.dome_name} · {r.check_in} al {r.check_out} · {r.guests} huésped(es)</p>
              <p className="mt-1 text-xs text-slate-700">
                Total {cop(r.total_amount)} · Pagado {cop(r.amount_paid ?? 0)} · Pendiente {cop(r.amount_pending)} · Pago: {r.payment_status}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
