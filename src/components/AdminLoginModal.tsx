import React, { useEffect, useState } from 'react';
import { X, Shield, LogIn } from 'lucide-react';
import { AdminUser } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { auth } from '../lib/firebase';
import { GoogleAuthProvider, getRedirectResult, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AdminUser) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const adminEmailEnv: string = import.meta.env.VITE_ADMIN_EMAIL || 'ecoglampingventas@gmail.com';

  // Valida que la cuenta de Google sea la de administración; si no, cierra la sesión.
  const finishLogin = async (user: User) => {
    const email = (user.email || '').toLowerCase();
    if (!email || (email !== adminEmailEnv.toLowerCase() && email !== 'ecoglampingventas@gmail.com')) {
      await signOut(auth);
      throw new Error(t('admin_login.unauthorized_email') || 'El correo electrónico no tiene privilegios de administrador autorizados.');
    }
    const adminUser: AdminUser = {
      id: 1,
      username: email.split('@')[0] || 'admin',
      full_name: user.displayName || 'Administrador Eco Glamping',
      email,
      role: 'SUPERADMIN',
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
        return 'El inicio de sesión con Google no está activado en Firebase (Authentication → Método de acceso).';
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

          <p className="text-sm text-slate-600 leading-relaxed">
            Inicia sesión con la cuenta de Google autorizada de administración (VITE_ADMIN_EMAIL) para acceder al panel de control de Eco Glamping Chinauta.
          </p>

          <div className="pt-2">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-semibold text-sm shadow-lg shadow-emerald-700/20 hover:from-emerald-700 hover:to-teal-800 transition-all flex items-center justify-center space-x-3"
            >
              <LogIn className="w-5 h-5" />
              <span>{loading ? 'Verificando con Firebase Auth...' : 'Iniciar Sesión con Google Admin'}</span>
            </button>
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
