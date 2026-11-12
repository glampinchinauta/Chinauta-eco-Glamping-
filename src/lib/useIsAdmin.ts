import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';

// Same rule as the server (ADMIN_EMAILS): a verified Google account on the admin list.
// The UI uses this only to show or hide controls. The server checks every request again.
const ADMIN_EMAIL = String(import.meta.env.VITE_ADMIN_EMAIL || 'ecoglampingventas@gmail.com').toLowerCase();

export function isAdminUser(user: User | null | undefined): boolean {
  return !!user && user.emailVerified === true && !!user.email &&
    (user.email.toLowerCase() === ADMIN_EMAIL || user.email.toLowerCase() === 'ecoglampingventas@gmail.com');
}

export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(() => isAdminUser(auth.currentUser));
  useEffect(() => onAuthStateChanged(auth, (user) => setIsAdmin(isAdminUser(user))), []);
  return isAdmin;
}
