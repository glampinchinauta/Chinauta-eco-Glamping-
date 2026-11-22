import React, { useEffect, useState } from 'react';
import { X, Shield, LogIn } from 'lucide-react';
import { AdminUser } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { auth } from '../lib/firebase';
import {
  GoogleAuthProvider, getRedirectResult, signInWithPopup, signInWithRedirect, signOut, type User,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail,
} from 'firebase/auth';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AdminUser) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Valida que la cuenta de Google sea la de administración; si no, cierra la sesión.
  const finishLogin = async (user: User) => {
    // El servidor decide si la cuenta es de administración (y con qué rol); aquí no se confía en el navegador.
    const token = await user.getIdToken();
    const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      await signOut(auth);
      throw new Error(t('admin_login.unauthorized_email') || 'El correo electrónico no tiene privilegios de administrador autorizados.');
    }
    const me = await res.json();
    const email = String(me.email || user.email || '').toLowerCase();
    const adminUser: AdminUser = {
      id: 1,
      username: email.split('@')[0] || 'admin',
      full_name: user.displayName || me.name || 'Administrador Eco Glamping',
      email,
      role: me.role === 'RECEPCION' ? 'RECEPCION' : 'SUPERADMIN',
      status: 'Activo'
    };
    onLoginSuccess(adminUser);
    onClose();
  };

  const friendlyError = (err: any): string => {
    switch (err?.code) {
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return 'Cerraste la ventana de Google antes de terminar. Inténtalo de nuevo.';
      case 'auth/unauthorized-domain':
        return 'Este sitio no está autorizado en Firebase. Agrega el dominio en Authentication → Configuración → Dominios autorizados.';
      case 'auth/operation-not-allowed':
        return 'Este método de acceso no está activado en Firebase (Authentication → Método de acceso).';
      case 'auth/invalid-email':
        return 'El correo no es válido.';
      case 'auth/missing-password':
        return 'Escribe tu contraseña.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Correo o contraseña incorrectos. Si es tu primera vez, usa «Crear mi contraseña».';
      case 'auth/email-already-in-use':
        return 'Ese correo ya tiene cuenta. Entra con tu contraseña, o toca «Olvidé mi contraseña».';
      case 'auth/weak-password':
        return 'La contraseña debe tener al menos 8 caracteres.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
      case 'auth/network-request-failed':
        return 'Sin conexión. Revisa tu internet e inténtalo de nuevo.';
      default:
        return err?.message || t('admin_login.err_creds');
    }
  };

  // Si el navegador (por ejemplo, en celulares) obligó a usar redirección, aquí se recibe el resultado al volver.
  useEffect(() => {
    let cancelled = false;
    getRedirectResult(auth)
      .then(async (result) => {
        if (!result || cancelled) return;
        setLoading(true);
        await finishLogin(result.user);
      })
      .catch((err) => {
        if (!cancelled) setError(friendlyError(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      let result;
      try {
        result = await signInWithPopup(auth, provider);
      } catch (err: any) {
        // Celulares o navegadores que bloquean ventanas emergentes: se usa redirección a Google.
        if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(auth, provider);
          return;
        }
        throw err;
      }
      await finishLogin(result.user);
    } catch (err: any) {
      console.error(err);
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: 'signin' | 'signup' | 'reset') => { setMode(next); setError(''); setInfo(''); };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const mail = email.trim();
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, mail);
        setInfo('Te enviamos un correo para crear una contraseña nueva. Revisa también la carpeta de spam.');
        return;
      }
      if (mode === 'signup') {
        if (password.length < 8) throw { code: 'auth/weak-password' };
        const cred = await createUserWithEmailAndPassword(auth, mail, password);
        await sendEmailVerification(cred.user);
        await signOut(auth);
        setPassword('');
        setMode('signin');
        setInfo('Listo. Te enviamos un correo: ábrelo y confirma tu dirección. Después vuelve aquí y entra con tu contraseña.');
        return;
      }
      const cred = await signInWithEmailAndPassword(auth, mail, password);
      if (!cred.user.emailVerified) {
        await sendEmailVerification(cred.user).catch(() => {});
        await signOut(auth);
        throw new Error('Falta confirmar tu correo. Te reenviamos el mensaje: ábrelo y vuelve a entrar.');
      }
      await finishLogin(cred.user);
    } catch (err: any) {
      setError(friendlyError(err));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = 'w-full h-12 px-4 rounded-2xl border border-slate-200 bg-white text-base focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden bg-white">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-emerald-950 text-white p-6 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold">{t('admin_login.title')}</h3>
              <p className="text-xs text-slate-400">Eco Glamping Chinauta</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-6 text-center">
          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm font-medium">
              ⚠️ {error}
            </div>
          )}

          {info && (
            <div role="status" className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium text-left">
              ✓ {info}
            </div>
          )}

          <p className="text-sm text-slate-600 leading-relaxed">
            Entra con tu cuenta de Google o con tu correo y contraseña. Tu correo debe estar autorizado por el administrador.
          </p>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-semibold text-sm shadow-lg shadow-emerald-700/20 hover:from-emerald-500 hover:to-teal-600 transition-all flex items-center justify-center space-x-3 disabled:opacity-60"
          >
            <LogIn className="w-5 h-5" />
            <span>{loading ? 'Verificando…' : 'Entrar con Google'}</span>
          </button>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex-1 h-px bg-slate-200" /> o con tu correo <span className="flex-1 h-px bg-slate-200" />
          </div>

          <form onSubmit={handleEmailSubmit} className="space-y-3 text-left">
            <div>
              <label htmlFor="adm-email" className="block text-sm font-semibold text-slate-700 mb-1.5">Correo</label>
              <input id="adm-email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
            </div>
            {mode !== 'reset' && (
              <div>
                <label htmlFor="adm-pass" className="block text-sm font-semibold text-slate-700 mb-1.5">
                  {mode === 'signup' ? 'Crea tu contraseña (mínimo 8 caracteres)' : 'Contraseña'}
                </label>
                <input id="adm-pass" type="password" required minLength={mode === 'signup' ? 8 : undefined} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />
              </div>
            )}
            <button disabled={loading} className="w-full h-12 rounded-2xl bg-slate-900 text-white font-semibold hover:bg-slate-800 disabled:opacity-60">
              {mode === 'signin' ? 'Entrar' : mode === 'signup' ? 'Crear mi contraseña' : 'Enviarme el correo'}
            </button>
          </form>

          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
            {mode !== 'signin' && <button onClick={() => switchMode('signin')} className="font-semibold text-emerald-700 hover:underline">Ya tengo contraseña</button>}
            {mode !== 'signup' && <button onClick={() => switchMode('signup')} className="font-semibold text-emerald-700 hover:underline">Crear mi contraseña (primera vez)</button>}
            {mode !== 'reset' && <button onClick={() => switchMode('reset')} className="text-slate-500 hover:underline">Olvidé mi contraseña</button>}
          </div>

          <div className="pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-400">
              Autenticación segura respaldada por Firebase Auth
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};
