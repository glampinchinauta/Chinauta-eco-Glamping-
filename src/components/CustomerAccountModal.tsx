import React, { useEffect, useState } from 'react';
import { X, UserCircle, LogOut, CalendarDays, MailCheck } from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  signOut,
  onAuthStateChanged,
  reload,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { readJson } from '../lib/api';
import { useLanguage } from '../context/LanguageContext';

interface CustomerAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Mode = 'login' | 'register' | 'reset';

interface AccountReservation {
  reservation_code: string;
  dome_name: string;
  check_in: string;
  check_out: string;
  guests: number;
  status: string;
  payment_status: string;
  total_amount: number;
  amount_pending: number;
}

const TEXT = {
  es: {
    title: 'Mi cuenta',
    subtitle: 'Inicia sesión o crea tu cuenta para ver tus reservas',
    login: 'Iniciar sesión',
    register: 'Crear cuenta',
    name: 'Nombre completo',
    email: 'Correo electrónico',
    password: 'Contraseña (mínimo 8 caracteres)',
    submitLogin: 'Entrar',
    submitRegister: 'Crear mi cuenta',
    submitReset: 'Enviar enlace',
    google: 'Continuar con Google',
    or: 'o',
    forgot: '¿Olvidaste tu contraseña?',
    toReset: 'Recuperar contraseña',
    backToLogin: 'Volver a iniciar sesión',
    resetIntro: 'Escribe tu correo y te enviaremos un enlace para crear una contraseña nueva.',
    resetSent: 'Si el correo está registrado, te enviamos un enlace para cambiar tu contraseña.',
    registered: 'Cuenta creada. Te enviamos un correo para verificarla.',
    verifyTitle: 'Verifica tu correo',
    verifyText: 'Abre el correo que te enviamos y confirma tu cuenta para ver tus reservas.',
    resend: 'Reenviar correo',
    resent: 'Correo de verificación reenviado.',
    refresh: 'Ya lo verifiqué',
    stillUnverified: 'Aún no vemos tu correo verificado. Revisa tu bandeja de spam.',
    hello: 'Hola',
    myRes: 'Mis reservas',
    noRes: 'Todavía no tienes reservas asociadas a este correo.',
    loadingRes: 'Cargando tus reservas…',
    loadErr: 'No pudimos cargar tus reservas. Intenta de nuevo.',
    dome: 'Domo',
    dates: 'Fechas',
    code: 'Código',
    total: 'Total',
    pending: 'Saldo pendiente',
    logout: 'Cerrar sesión',
    pwShort: 'La contraseña debe tener al menos 8 caracteres.',
    errors: {
      'auth/invalid-credential': 'Correo o contraseña incorrectos.',
      'auth/wrong-password': 'Correo o contraseña incorrectos.',
      'auth/user-not-found': 'Correo o contraseña incorrectos.',
      'auth/email-already-in-use': 'Ese correo ya tiene una cuenta. Inicia sesión.',
      'auth/weak-password': 'La contraseña debe tener al menos 8 caracteres.',
      'auth/invalid-email': 'El correo no es válido.',
      'auth/too-many-requests': 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
      'auth/network-request-failed': 'Sin conexión. Revisa tu internet.',
      default: 'No pudimos completar la operación. Intenta de nuevo.',
    },
  },
  en: {
    title: 'My account',
    subtitle: 'Sign in or create an account to see your reservations',
    login: 'Sign in',
    register: 'Create account',
    name: 'Full name',
    email: 'Email',
    password: 'Password (at least 8 characters)',
    submitLogin: 'Sign in',
    submitRegister: 'Create my account',
    submitReset: 'Send link',
    google: 'Continue with Google',
    or: 'or',
    forgot: 'Forgot your password?',
    toReset: 'Reset password',
    backToLogin: 'Back to sign in',
    resetIntro: 'Enter your email and we will send you a link to set a new password.',
    resetSent: 'If the email is registered, we sent you a link to change your password.',
    registered: 'Account created. We sent you an email to verify it.',
    verifyTitle: 'Verify your email',
    verifyText: 'Open the email we sent you and confirm your account to see your reservations.',
    resend: 'Resend email',
    resent: 'Verification email sent again.',
    refresh: 'I already verified it',
    stillUnverified: 'We still do not see your email verified. Check your spam folder.',
    hello: 'Hello',
    myRes: 'My reservations',
    noRes: 'You have no reservations linked to this email yet.',
    loadingRes: 'Loading your reservations…',
    loadErr: 'We could not load your reservations. Please try again.',
    dome: 'Dome',
    dates: 'Dates',
    code: 'Code',
    total: 'Total',
    pending: 'Balance due',
    logout: 'Sign out',
    pwShort: 'The password must have at least 8 characters.',
    errors: {
      'auth/invalid-credential': 'Incorrect email or password.',
      'auth/wrong-password': 'Incorrect email or password.',
      'auth/user-not-found': 'Incorrect email or password.',
      'auth/email-already-in-use': 'That email already has an account. Please sign in.',
      'auth/weak-password': 'The password must have at least 8 characters.',
      'auth/invalid-email': 'The email is not valid.',
      'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
      'auth/network-request-failed': 'No connection. Check your internet.',
      default: 'We could not complete the action. Please try again.',
    },
  },
};

const money = (n: number) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

export const CustomerAccountModal: React.FC<CustomerAccountModalProps> = ({ isOpen, onClose }) => {
  const { language } = useLanguage();
  const tx = TEXT[language === 'en' ? 'en' : 'es'];

  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [reservations, setReservations] = useState<AccountReservation[] | null>(null);
  const [resError, setResError] = useState('');
  const [, forceRender] = useState(0);

  // Re-render whenever the Firebase session changes (sign in, sign out, email verified).
  useEffect(() => onAuthStateChanged(auth, () => forceRender((n) => n + 1)), []);

  const current = auth.currentUser;
  const verified = !!current?.emailVerified;

  const friendly = (err: any) => {
    const code = String(err?.code || '');
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return '';
    return (tx.errors as Record<string, string>)[code] || tx.errors.default;
  };

  const loadReservations = async () => {
    setResError('');
    try {
      const res = await fetch('/api/me/reservations');
      const data = await readJson(res);
      if (!res.ok) {
        setResError(data.error || tx.loadErr);
        setReservations(null);
        return;
      }
      setReservations(Array.isArray(data) ? data : []);
    } catch {
      setResError(tx.loadErr);
      setReservations(null);
    }
  };

  useEffect(() => {
    if (isOpen && current && verified) {
      loadReservations();
    } else {
      setReservations(null);
      setResError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, current?.uid, verified]);

  if (!isOpen) return null;

  const resetMessages = () => { setError(''); setInfo(''); };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      setPassword('');
    } catch (err: any) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    if (password.length < 8) {
      setError(tx.pwShort);
      return;
    }
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() });
      await sendEmailVerification(cred.user);
      setPassword('');
      setInfo(tx.registered);
    } catch (err: any) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo(tx.resetSent);
    } catch (err: any) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  };

  const signInGoogle = async () => {
    resetMessages();
    setBusy(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err: any) {
      const msg = friendly(err);
      if (msg) setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const resendVerification = async () => {
    resetMessages();
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
      setInfo(tx.resent);
    } catch (err: any) {
      setError(friendly(err));
    }
  };

  const checkVerified = async () => {
    resetMessages();
    if (!auth.currentUser) return;
    await reload(auth.currentUser);
    forceRender((n) => n + 1);
    if (auth.currentUser.emailVerified) {
      loadReservations();
    } else {
      setInfo(tx.stillUnverified);
    }
  };

  const logout = async () => {
    resetMessages();
    await signOut(auth);
    setReservations(null);
  };

  const fmtDate = (d: string) =>
    new Date(`${d}T00:00:00`).toLocaleDateString(language === 'en' ? 'en-US' : 'es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="glass-card w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden bg-white my-8">
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 text-white p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <UserCircle className="w-6 h-6 text-emerald-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold">{tx.title}</h3>
              <p className="text-xs text-emerald-200">{current && verified ? current.displayName || current.email : tx.subtitle}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="p-2 rounded-xl hover:bg-white/10 text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 sm:p-8 space-y-5 max-h-[72vh] overflow-y-auto">
          {error && <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-sm font-medium border border-rose-200">{error}</div>}
          {info && <div className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm font-medium border border-emerald-200">{info}</div>}

          {/* Signed in but email not verified yet */}
          {current && !verified && (
            <div className="space-y-4 text-center">
              <MailCheck className="w-12 h-12 mx-auto text-emerald-600" />
              <h4 className="text-lg font-bold text-slate-900">{tx.verifyTitle}</h4>
              <p className="text-sm text-slate-600">{tx.verifyText}</p>
              <p className="text-xs text-slate-500 break-all">{current.email}</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button type="button" onClick={checkVerified} className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold">{tx.refresh}</button>
                <button type="button" onClick={resendVerification} className="px-5 py-3 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50">{tx.resend}</button>
              </div>
              <button type="button" onClick={logout} className="text-sm text-slate-500 hover:text-slate-800 underline">{tx.logout}</button>
            </div>
          )}

          {/* Signed in and verified: own reservations */}
          {current && verified && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">{tx.hello}, {current.displayName || current.email}</p>
                <button type="button" onClick={logout} className="flex items-center space-x-1.5 text-sm text-slate-600 hover:text-rose-600">
                  <LogOut className="w-4 h-4" /><span>{tx.logout}</span>
                </button>
              </div>
              <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2"><CalendarDays className="w-5 h-5 text-emerald-600" /><span>{tx.myRes}</span></h4>
              {resError && <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-sm">{resError}</div>}
              {!resError && reservations === null && <p className="text-sm text-slate-500">{tx.loadingRes}</p>}
              {reservations && reservations.length === 0 && <p className="text-sm text-slate-500">{tx.noRes}</p>}
              {reservations && reservations.map((r) => (
                <div key={r.reservation_code} className="p-4 rounded-2xl border border-slate-200 bg-slate-50 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{r.dome_name}</span>
                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-800">{r.status}</span>
                  </div>
                  <p className="text-sm text-slate-600">{tx.dates}: {fmtDate(r.check_in)} → {fmtDate(r.check_out)} · {r.guests}</p>
                  <p className="text-sm text-slate-600">{tx.code}: <span className="font-mono font-semibold">{r.reservation_code}</span></p>
                  <p className="text-sm text-slate-600">{tx.total}: {money(r.total_amount)} · {tx.pending}: {money(r.amount_pending)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Signed out: login, register or reset */}
          {!current && mode !== 'reset' && (
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button type="button" onClick={() => { resetMessages(); setMode('login'); }} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${mode === 'login' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>{tx.login}</button>
              <button type="button" onClick={() => { resetMessages(); setMode('register'); }} className={`flex-1 py-2 rounded-lg text-sm font-semibold ${mode === 'register' ? 'bg-white shadow text-slate-900' : 'text-slate-500'}`}>{tx.register}</button>
            </div>
          )}

          {!current && mode === 'login' && (
            <form onSubmit={submitLogin} className="space-y-4">
              <input type="email" required placeholder={tx.email} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-emerald-500" />
              <input type="password" required placeholder={tx.password} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-emerald-500" />
              <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-semibold text-sm disabled:opacity-60">{tx.submitLogin}</button>
              <button type="button" onClick={() => { resetMessages(); setMode('reset'); }} className="w-full text-sm text-emerald-700 hover:underline">{tx.forgot}</button>
            </form>
          )}

          {!current && mode === 'register' && (
            <form onSubmit={submitRegister} className="space-y-4">
              <input type="text" required placeholder={tx.name} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-emerald-500" />
              <input type="email" required placeholder={tx.email} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-emerald-500" />
              <input type="password" required minLength={8} placeholder={tx.password} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-emerald-500" />
              <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-semibold text-sm disabled:opacity-60">{tx.submitRegister}</button>
            </form>
          )}

          {!current && mode === 'reset' && (
            <form onSubmit={submitReset} className="space-y-4">
              <p className="text-sm text-slate-600">{tx.resetIntro}</p>
              <input type="email" required placeholder={tx.email} value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-emerald-500" />
              <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-semibold text-sm disabled:opacity-60">{tx.submitReset}</button>
              <button type="button" onClick={() => { resetMessages(); setMode('login'); }} className="w-full text-sm text-slate-600 hover:underline">{tx.backToLogin}</button>
            </form>
          )}

          {!current && mode !== 'reset' && (
            <>
              <div className="flex items-center gap-3 text-xs text-slate-400"><span className="flex-1 h-px bg-slate-200" />{tx.or}<span className="flex-1 h-px bg-slate-200" /></div>
              <button type="button" onClick={signInGoogle} disabled={busy} className="w-full py-3 rounded-xl border border-slate-200 text-slate-800 font-semibold text-sm hover:bg-slate-50 disabled:opacity-60">{tx.google}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
