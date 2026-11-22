import React, { useState, useEffect } from 'react';
import { LayoutDashboard, BedDouble, DollarSign, FileText, Shield, Settings, LogOut, Plus, TrendingUp, Utensils, Wallet, Activity, Sparkles, Percent, RefreshCw, Bell, PieChart as PieIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { requestStaffNotificationPermission } from '../lib/firebase';
import { PageFade, SegmentedTabs, Modal, fieldClass, labelClass, fmtCOP, Card, EmptyState, LoadingBlocks, CountUp } from './admin/ui';
import { TodayView } from './admin/TodayView';
import { ReservationsView } from './admin/ReservationsView';
import { CalendarView } from './admin/CalendarView';
import { GuestsView } from './admin/GuestsView';
import { TeamView, type StaffMember } from './admin/TeamView';
import { NewReservationModal } from './admin/NewReservationModal';
import { CHINAUTA_MENU_ITEMS } from './FoodMenuSection';
import { ImageCarousel } from './ImageCarousel';
import { getDomeImages } from '../utils/domeImages';
import { AdminUser, Reservation, Dome, Customer, Payment, MaintenanceBlock, AuditLog } from '../types';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, 
  BarChart, Bar, Legend, PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import { useLanguage } from '../context/LanguageContext';

type ViewId = 'dashboard' | 'charts' | 'finances' | 'reservations' | 'calendar' | 'customers'
  | 'domes' | 'images' | 'restaurant' | 'users' | 'audit' | 'settings';
type DataKey = 'metrics' | 'domes' | 'reservations' | 'customers' | 'payments' | 'maintenance'
  | 'audit' | 'finances' | 'settings' | 'staff' | 'analytics';

const DATA_URLS: Record<DataKey, string> = {
  metrics: '/api/dashboard/metrics',
  domes: '/api/domes',
  reservations: '/api/reservations',
  customers: '/api/customers',
  payments: '/api/payments',
  maintenance: '/api/maintenance',
  audit: '/api/audit',
  finances: '/api/finances/summary',
  settings: '/api/settings',
  staff: '/api/staff',
  analytics: '/api/analytics/charts',
};

// Qué datos necesita cada vista.
const VIEW_DATA: Record<ViewId, DataKey[]> = {
  dashboard: ['finances', 'reservations', 'domes'],
  charts: ['analytics', 'reservations'],
  finances: ['finances', 'payments'],
  reservations: ['reservations', 'domes'],
  calendar: ['reservations', 'domes', 'maintenance'],
  customers: ['customers'],
  domes: ['domes', 'maintenance'],
  images: ['domes'],
  restaurant: [],
  users: ['staff'],
  audit: ['audit'],
  settings: ['settings'],
};

// Menú lateral: 6 secciones; las que tienen varias vistas las muestran como pestañas.
const SECTIONS: {
  id: string; labelKey: string; icon: React.ComponentType<{ className?: string }>;
  shortKey?: string; superOnly?: boolean; views: { id: ViewId; labelKey: string }[];
}[] = [
  { id: 'summary', labelKey: 'admin.section_summary', icon: LayoutDashboard, views: [
    { id: 'dashboard', labelKey: 'admin.tab_today' },
    { id: 'charts', labelKey: 'admin.menu_charts' },
    { id: 'finances', labelKey: 'admin.menu_finances' },
  ] },
  { id: 'reservations', labelKey: 'admin.menu_reservations', icon: FileText, views: [
    { id: 'reservations', labelKey: 'admin.menu_reservations' },
    { id: 'calendar', labelKey: 'admin.menu_calendar' },
    { id: 'customers', labelKey: 'admin.menu_customers' },
  ] },
  { id: 'domes', labelKey: 'admin.menu_domes', icon: BedDouble, views: [
    { id: 'domes', labelKey: 'admin.tab_domes' },
    { id: 'images', labelKey: 'admin.tab_photos' },
  ] },
  { id: 'restaurant', labelKey: 'admin.menu_restaurant', shortKey: 'admin.nav_menu', icon: Utensils, views: [
    { id: 'restaurant', labelKey: 'admin.menu_restaurant' },
  ] },
  // Recepción no puede leer usuarios, auditoría ni configuración (lo bloquea el servidor), así que no los ve.
  { id: 'team', labelKey: 'admin.section_team', shortKey: 'admin.nav_team', icon: Shield, superOnly: true, views: [
    { id: 'users', labelKey: 'admin.menu_users' },
    { id: 'audit', labelKey: 'admin.menu_audit' },
  ] },
  { id: 'settings', labelKey: 'admin.menu_settings', shortKey: 'admin.nav_settings', icon: Settings, superOnly: true, views: [
    { id: 'settings', labelKey: 'admin.menu_settings' },
  ] },
];

interface AdminDashboardProps {
  user: AdminUser;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ user, onLogout }) => {
  const { t } = useLanguage();
  // Recepción abre directo en Reservas; el administrador, en el resumen.
  const [activeMenu, setActiveMenu] = useState<ViewId>(user.role === 'RECEPCION' ? 'reservations' : 'dashboard');
  const [metrics, setMetrics] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [chartPeriod, setChartPeriod] = useState<'6m' | '1y' | 'all'>('6m');

  const handleMenuSelect = (menu: ViewId) => {
    setActiveMenu(menu);
  };
  const [domes, setDomes] = useState<Dome[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceBlock[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [finances, setFinances] = useState<any>(null);
  const [settings, setSettings] = useState<any>({});
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [showNewReservation, setShowNewReservation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState<Set<DataKey>>(new Set());
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'error' } | null>(null);

  const notify = (msg: string, kind: 'ok' | 'error' = 'ok') => {
    setToast({ msg, kind });
    window.setTimeout(() => setToast(cur => (cur && cur.msg === msg ? null : cur)), 3200);
  };

  // Modals state
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedResIdForPayment, setSelectedResIdForPayment] = useState<number | null>(null);

  // Maintenance form state
  const [maintDomeId, setMaintDomeId] = useState(1);
  const [maintStart, setMaintStart] = useState('');
  const [maintEnd, setMaintEnd] = useState('');
  const [maintReason, setMaintReason] = useState('Mantenimiento preventivo');

  // Payment form state
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('Transferencia Bancaria');

  // Cada vista pide solo los datos que usa (antes cada clic descargaba 11 endpoints).
  const loadData = async (keys: DataKey[]) => {
    if (keys.length === 0) return;
    setLoading(true);
    try {
      const get = (url: string) => fetch(url).then(r => r.json()).catch(() => null);
      await Promise.all(keys.map(async key => {
        const data = await get(DATA_URLS[key]);
        if (data !== null && data !== undefined) {
          const isList = Array.isArray(data);
          const isObject = !isList && typeof data === 'object' && !(data as any).error;
          switch (key) {
            case 'metrics': if (isObject) setMetrics(data); break;
            case 'domes': if (isList) setDomes(data); break;
            case 'reservations': if (isList) setReservations(data); break;
            case 'customers': if (isList) setCustomers(data); break;
            case 'payments': if (isList) setPayments(data); break;
            case 'maintenance': if (isList) setMaintenance(data); break;
            case 'audit': if (isList) setAuditLogs(data); break;
            case 'finances': if (isObject) setFinances(data); break;
            case 'settings': if (isObject) setSettings(data); break;
            case 'staff': if (isList) setStaff(data); break;
            case 'analytics': if (isObject) setAnalyticsData(data); break;
          }
        }
        setLoaded(prev => new Set(prev).add(key));
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const reload = () => loadData(VIEW_DATA[activeMenu] || []);

  useEffect(() => {
    loadData(VIEW_DATA[activeMenu] || []);
  }, [activeMenu]);

  // El cambio se ve al instante; si el servidor lo rechaza, se vuelve a cargar y se avisa.
  const handleUpdateStatus = async (id: number, status: string) => {
    setReservations(prev => prev.map(r => (r.id === id ? { ...r, status: status as Reservation['status'] } : r)));
    try {
      const res = await fetch(`/api/reservations/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, user_name: user.full_name })
      });
      if (!res.ok) throw new Error('status');
      notify(status === 'Cancelada' ? 'Reserva cancelada' : `Listo: ahora está «${status}»`);
      loadData(['reservations']);
    } catch (err) {
      notify(t('admin.alert_status_error'), 'error');
      reload();
    }
  };

  const handleAddStaff = async (email: string, name: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'No se pudo dar el acceso.');
      notify('Acceso de recepción creado');
      loadData(['staff']);
      return true;
    } catch (err: any) {
      notify(err.message, 'error');
      return false;
    }
  };

  const handleRemoveStaff = async (email: string) => {
    try {
      const res = await fetch(`/api/staff/${encodeURIComponent(email)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('No se pudo quitar el acceso.');
      notify('Acceso quitado');
      loadData(['staff']);
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const openCollect = (resv: Reservation) => {
    setSelectedResIdForPayment(resv.id);
    setPayAmount(resv.amount_pending || resv.total_amount);
    setShowPaymentModal(true);
  };

  const handleCreateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dome_id: maintDomeId,
          start_date: maintStart,
          end_date: maintEnd,
          reason: maintReason,
          user_name: user.full_name
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowMaintenanceModal(false);
      reload();
      notify(t('admin.alert_maint_success'));
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResIdForPayment) return;
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservation_id: selectedResIdForPayment,
          amount: payAmount,
          method: payMethod,
          user_name: user.full_name
        })
      });
      if (!res.ok) throw new Error("Error registrando pago");

      setShowPaymentModal(false);
      setSelectedResIdForPayment(null);
      reload();
      notify(t('admin.alert_payment_success'));
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleUpdateDomeImage = async (domeId: number, newUrl: string) => {
    try {
      const domeToUpdate = domes.find(d => d.id === domeId);
      if (!domeToUpdate) return;
      const res = await fetch(`/api/domes/${domeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...domeToUpdate,
          image_url: newUrl,
          user_name: user.full_name
        })
      });
      if (!res.ok) throw new Error("Error al actualizar la imagen");
      reload();
      notify(t('admin.alert_img_success'));
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const handleUpdateDomeGallery = async (domeId: number, newImages: string[]) => {
    try {
      const domeToUpdate = domes.find(d => d.id === domeId);
      if (!domeToUpdate) return;
      const res = await fetch(`/api/domes/${domeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...domeToUpdate,
          image_url: newImages[0] || domeToUpdate.image_url,
          images: newImages,
          user_name: user.full_name
        })
      });
      if (!res.ok) throw new Error("Error al actualizar las fotos");
      reload();
      notify(t('admin.alert_gallery_success'));
    } catch (err: any) {
      notify(err.message, 'error');
    }
  };

  const calculateFirestoreRevenueOverview = () => {
    const monthlyMap: { [key: string]: { revenue: number; collected: number; count: number } } = {};
    const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    
    const now = new Date();
    const monthsCount = chartPeriod === '1y' ? 12 : chartPeriod === 'all' ? 24 : 6;
    
    for (let i = monthsCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${monthNames[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`;
      monthlyMap[key] = { revenue: 0, collected: 0, count: 0 };
    }

    reservations.forEach(resv => {
      if (resv.status === 'Cancelada') return;
      const dateStr = resv.check_in || resv.created_at;
      if (!dateStr) return;
      const resDate = new Date(dateStr);
      if (isNaN(resDate.getTime())) return;
      const key = `${monthNames[resDate.getMonth()]} '${String(resDate.getFullYear()).slice(-2)}`;
      if (monthlyMap[key]) {
        monthlyMap[key].revenue += (resv.total_amount || 0);
        monthlyMap[key].collected += (resv.amount_paid !== undefined ? resv.amount_paid : ((resv.payment_status === 'Pagado') ? resv.total_amount : 0));
        monthlyMap[key].count += 1;
      }
    });

    return Object.keys(monthlyMap).map((month, idx) => {
      const data = monthlyMap[month];
            return {
        month,
        revenue: data.revenue,
        collected: data.collected,
        reservationsCount: data.count
      };
    });
  };

  const revenueOverviewData = calculateFirestoreRevenueOverview();

  const visibleSections = SECTIONS.filter(sec => !sec.superOnly || user.role === 'SUPERADMIN');
  const currentSection = visibleSections.find(sec => sec.views.some(v => v.id === activeMenu)) || visibleSections[0];
  const sectionViews = currentSection.views;
  const isReady = (VIEW_DATA[activeMenu] || []).every(k => loaded.has(k));
  const firstName = ((user.full_name || '').includes('@' ) ? user.full_name.split('@')[0] : (user.full_name || 'equipo').split(' ')[0]) || 'equipo';
  const payingRes = reservations.find(r => r.id === selectedResIdForPayment);
  const pendingCount = reservations.filter(r => ['Pendiente', 'Pendiente de pago'].includes(r.status)).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-50 to-emerald-50/50 flex flex-col md:flex-row">

      {/* Barra lateral (computador) */}
      <aside className="hidden md:flex w-64 shrink-0 sticky top-0 h-screen flex-col justify-between bg-slate-950 text-slate-300 overflow-hidden">
        <div aria-hidden className="egc-aurora absolute inset-0 pointer-events-none" />
        <div className="relative">
          <div className="p-6 flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-emerald-500/20">
              EGC
            </div>
            <div>
              <h2 className="font-bold text-white text-sm leading-tight">{t('admin.portal_title')}</h2>
              <p className="text-xs text-emerald-400 font-medium">Eco Glamping Chinauta</p>
            </div>
          </div>

          <nav className="px-3 space-y-1 text-sm font-medium" aria-label="Menú del panel">
            {visibleSections.map(section => {
              const Icon = section.icon;
              const isActive = section.id === currentSection.id;
              return (
                <button
                  key={section.id}
                  onClick={() => handleMenuSelect(section.views[0].id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-colors ${isActive ? 'text-white' : 'hover:bg-white/5 hover:text-white'}`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="admin-nav-pill"
                      className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 shadow-lg shadow-emerald-900/40"
                      transition={{ type: 'spring', stiffness: 450, damping: 38 }}
                    />
                  )}
                  <Icon className="relative w-5 h-5" />
                  <span className="relative">{t(section.labelKey)}</span>
                  {section.id === 'reservations' && pendingCount > 0 && (
                    <span title="Reservas por confirmar" className="relative ml-auto min-w-5 h-5 px-1.5 rounded-full bg-amber-400 text-slate-950 text-[11px] font-bold flex items-center justify-center">{pendingCount}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="relative p-4 m-3 rounded-2xl bg-white/5 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center">
              {firstName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{user.full_name}</p>
              <p className="text-[11px] text-emerald-400 font-semibold">{user.role === 'RECEPCION' ? 'Recepción' : 'Administrador'}</p>
            </div>
            <button
              onClick={onLogout} title={t('admin.logout')} aria-label={t('admin.logout')}
              className="p-2 rounded-xl bg-white/5 hover:bg-rose-600 hover:text-white text-slate-300 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => requestStaffNotificationPermission(user.username)}
            className="mt-3 w-full py-2 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Avisarme de nuevas reservas</span>
          </button>
        </div>
      </aside>

      {/* Barra superior (celular) */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 bg-slate-950/95 backdrop-blur text-white">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-slate-950 text-xs font-black shrink-0">EGC</div>
          <div className="min-w-0">
            <p className="font-bold text-sm leading-tight truncate">{t(currentSection.labelKey)}</p>
            <p className="text-[11px] text-emerald-400 truncate">{user.role === 'RECEPCION' ? 'Recepción' : 'Administrador'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reload} aria-label="Actualizar datos" className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"><RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} /></button>
          <button onClick={() => requestStaffNotificationPermission(user.username)} aria-label="Avisarme de nuevas reservas" className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"><Bell className="w-5 h-5 text-emerald-300" /></button>
          <button onClick={onLogout} aria-label={t('admin.logout')} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"><LogOut className="w-5 h-5" /></button>
        </div>
      </header>

      {/* Contenido */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-10 pb-28 md:pb-10 space-y-6">

        {/* Encabezado */}
        <div className={`flex-wrap items-center justify-between gap-3 ${activeMenu === 'domes' ? 'flex' : 'hidden md:flex'}`}>
          <div>
            <h1 className="hidden md:block text-2xl font-bold text-slate-900">{t(currentSection.labelKey)}</h1>
            <p className="hidden md:block text-xs text-slate-500 mt-0.5">Eco Glamping Chinauta • Hora de Colombia</p>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            {activeMenu === 'domes' && (
              <button
                onClick={() => setShowMaintenanceModal(true)}
                className="h-11 px-4 rounded-2xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition-colors flex items-center gap-2 egc-press"
              >
                <Plus className="w-4 h-4" />
                <span>{t('admin.new_maint_btn')}</span>
              </button>
            )}
            <button
              onClick={reload} title="Actualizar datos" aria-label="Actualizar datos"
              className="hidden md:flex w-11 h-11 rounded-2xl border border-slate-200 bg-white text-slate-600 hover:text-emerald-700 hover:bg-slate-50 transition-colors flex items-center justify-center egc-press"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Pestañas de la sección */}
        {sectionViews.length > 1 && (
          <SegmentedTabs<ViewId>
            group="section" value={activeMenu} onChange={setActiveMenu}
            tabs={sectionViews.map(v => ({ id: v.id, label: t(v.labelKey) }))}
          />
        )}

        <AnimatePresence mode="wait" initial={false}>
        <PageFade key={activeMenu} className="space-y-8">

        {activeMenu === 'dashboard' && (
          <TodayView
            firstName={firstName} reservations={reservations} domes={domes} finances={finances}
            ready={isReady} onStatus={handleUpdateStatus} onCollect={openCollect}
          />
        )}


        {/* 1.1 COMPREHENSIVE CHARTS & ANALYTICS VIEW */}
        {activeMenu === 'charts' && (
          <div className="space-y-8">
            
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="glass-card p-6 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Tasa de Ocupación Global</span>
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                    <Percent className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-3xl font-bold text-slate-900">{analyticsData?.summary?.avgOccupancy ?? 0}%</h3>
                </div>
                <p className="text-xs text-slate-500">Promedio de todos los domos</p>
              </div>

              <div className="glass-card p-6 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Domo de Mayor Ocupación</span>
                  <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                    <Sparkles className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{analyticsData?.summary?.topDome || 'Sin reservas aún'}</h3>
                </div>
                <p className="text-xs text-slate-500">El que más ingresos ha generado</p>
              </div>

              <div className="glass-card p-6 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Crecimiento de Reservas</span>
                  <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-3xl font-bold text-slate-900">{(analyticsData?.summary?.growthPercentage ?? 0) > 0 ? '+' : ''}{analyticsData?.summary?.growthPercentage ?? 0}%</h3>
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                    {analyticsData?.summary?.totalBookingsThisMonth ?? 0} reservas
                  </span>
                </div>
                <p className="text-xs text-slate-500">Comparado con el mes anterior</p>
              </div>

              <div className="glass-card p-6 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-bold uppercase tracking-wider">Ticket Promedio Estadía</span>
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">
                    ${(analyticsData?.summary?.avgTicketCOP ?? 0).toLocaleString('es-CO')}
                  </h3>
                  <p className="text-xs font-bold text-amber-600 mt-1">COP por noche / domo</p>
                </div>
                <p className="text-xs text-slate-500">Promedio por reserva</p>
              </div>
            </div>

            {/* FIRESTORE REVENUE OVERVIEW CHART */}
            <div className="glass-card p-6 sm:p-8 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-1">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>Resumen de ingresos</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Evolución y Ganancias Mensuales</h3>
                  <p className="text-xs text-slate-500">Lo reservado frente a lo que ya se ha cobrado, mes a mes.</p>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
                    <button
                      onClick={() => setChartPeriod('6m')}
                      className={`px-3 py-1.5 rounded-lg transition-colors ${chartPeriod === '6m' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      6 Meses
                    </button>
                    <button
                      onClick={() => setChartPeriod('1y')}
                      className={`px-3 py-1.5 rounded-lg transition-colors ${chartPeriod === '1y' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      1 Año
                    </button>
                    <button
                      onClick={() => setChartPeriod('all')}
                      className={`px-3 py-1.5 rounded-lg transition-colors ${chartPeriod === 'all' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Histórico
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-6 text-xs font-bold pt-2">
                <span className="flex items-center space-x-2 text-slate-700">
                  <span className="w-3 h-3 rounded-md bg-emerald-600 inline-block"></span>
                  <span>Ingresos Facturados (COP)</span>
                </span>
                <span className="flex items-center space-x-2 text-slate-700">
                  <span className="w-3 h-3 rounded-md bg-teal-400 inline-block"></span>
                  <span>Pagos Recaudados (COP)</span>
                </span>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueOverviewData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevOverview" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#059669" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#059669" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorCollOverview" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" stroke="#64748b" />
                    <YAxis stroke="#64748b" tickFormatter={(v) => `$${(v / 1000000).toFixed(0)}M`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff' }}
                      formatter={(val: any, name: any) => [
                        `$${Number(val).toLocaleString('es-CO')} COP`,
                        name === 'revenue' ? 'Ingresos Facturados' : 'Pagos Recaudados'
                      ]}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={3} fillOpacity={1} fill="url(#colorRevOverview)" name="revenue" />
                    <Area type="monotone" dataKey="collected" stroke="#2dd4bf" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCollOverview)" name="collected" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* CHART 1: Booking Trends */}
            <div className="glass-card p-6 sm:p-8 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-1">
                    <Activity className="w-3.5 h-3.5" />
                    <span>Tendencias de Reservas</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Volumen y Tendencias de Reservas</h3>
                  <p className="text-xs text-slate-500">Evolución de reservas solicitadas, confirmadas y número de huéspedes recibidos.</p>
                </div>
                <div className="flex items-center space-x-4 text-xs font-bold">
                  <span className="flex items-center space-x-1.5 text-slate-700">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span>
                    <span>Total Reservas</span>
                  </span>
                  <span className="flex items-center space-x-1.5 text-slate-700">
                    <span className="w-3 h-3 rounded-full bg-cyan-500 inline-block"></span>
                    <span>Confirmadas</span>
                  </span>
                  <span className="flex items-center space-x-1.5 text-slate-700">
                    <span className="w-3 h-3 rounded-full bg-indigo-400 inline-block"></span>
                    <span>Huéspedes</span>
                  </span>
                </div>
              </div>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analyticsData?.bookingTrends || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorBookings" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorConfirmed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35}/>
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" stroke="#64748b" />
                    <YAxis stroke="#64748b" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff' }}
                      formatter={(val: any, name: any) => [
                        val,
                        name === 'totalBookings' ? 'Total Solicitadas' : name === 'confirmed' ? 'Confirmadas' : 'Huéspedes'
                      ]}
                    />
                    <Area type="monotone" dataKey="totalBookings" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorBookings)" name="totalBookings" />
                    <Area type="monotone" dataKey="confirmed" stroke="#06b6d4" strokeWidth={2.5} fillOpacity={1} fill="url(#colorConfirmed)" name="confirmed" />
                    <Line type="monotone" dataKey="guests" stroke="#818cf8" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 4 }} name="guests" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* CHART 2: Occupancy Rates per Dome (All 6 Ancestral Domes) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Bar Chart 2/3 */}
              <div className="lg:col-span-2 glass-card p-6 sm:p-8 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold mb-1">
                      <BedDouble className="w-3.5 h-3.5" />
                      <span>Ocupación por Domo</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Tasa de Ocupación por Domo Ancestral</h3>
                    <p className="text-xs text-slate-500">Porcentaje de ocupación en los 6 domos del glamping.</p>
                  </div>
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                    6 Domos Activos
                  </span>
                </div>

                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData?.domeOccupancy || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="shortName" stroke="#64748b" tick={{ fontSize: 11 }} />
                      <YAxis stroke="#64748b" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff' }}
                        formatter={(val: any, _name: any, item: any) => [
                          `${val}% (${item?.payload?.nightsBooked || 0} noches reservadas)`,
                          'Tasa de Ocupación'
                        ]}
                      />
                      <Bar dataKey="occupancyRate" radius={[8, 8, 0, 0]}>
                        {(analyticsData?.domeOccupancy || []).map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color || '#10b981'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Dome Occupancy Details List 1/3 */}
              <div className="glass-card p-6 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-4 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 text-base">Desglose por Domo</h4>
                  <p className="text-xs text-slate-500">Capacidad, noches y porcentaje</p>
                </div>

                <div className="space-y-3">
                  {(analyticsData?.domeOccupancy || []).map((dome: any) => (
                    <div key={dome.id} className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: dome.color }}></span>
                          <span>{dome.name}</span>
                        </span>
                        <span className="font-bold text-emerald-700">{dome.occupancyRate}%</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-500" 
                          style={{ width: `${dome.occupancyRate}%`, backgroundColor: dome.color }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{dome.nightsBooked} noches / mes</span>
                        <span>${dome.revenue?.toLocaleString('es-CO')} COP</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CHART 3 & 4: Monthly Revenue Comparison & Revenue Share */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Monthly Revenue Bar Chart 2/3 */}
              <div className="lg:col-span-2 glass-card p-6 sm:p-8 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold mb-1">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Ingresos Mensuales</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">Ingresos Facturados vs Recaudados</h3>
                    <p className="text-xs text-slate-500">Comparativa mensual de facturación total contra pagos efectivamente recibidos (COP).</p>
                  </div>
                  <div className="flex items-center space-x-4 text-xs font-bold">
                    <span className="flex items-center space-x-1.5 text-slate-700">
                      <span className="w-3 h-3 rounded-md bg-emerald-600 inline-block"></span>
                      <span>Facturado</span>
                    </span>
                    <span className="flex items-center space-x-1.5 text-slate-700">
                      <span className="w-3 h-3 rounded-md bg-teal-400 inline-block"></span>
                      <span>Recaudado</span>
                    </span>
                  </div>
                </div>

                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData?.monthlyRevenue || []} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" stroke="#64748b" />
                      <YAxis stroke="#64748b" tickFormatter={(v) => `$${(v / 1000000).toFixed(0)}M`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff' }}
                        formatter={(val: any, name: any) => [
                          `$${Number(val).toLocaleString('es-CO')} COP`,
                          name === 'revenue' ? 'Ingresos Facturados' : 'Pagos Recaudados'
                        ]}
                      />
                      <Bar dataKey="revenue" fill="#059669" radius={[6, 6, 0, 0]} name="revenue" />
                      <Bar dataKey="collected" fill="#2dd4bf" radius={[6, 6, 0, 0]} name="collected" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Revenue Share Pie Chart 1/3 */}
              <div className="glass-card p-6 sm:p-8 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-6 flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold mb-1">
                    <PieIcon className="w-3.5 h-3.5" />
                    <span>Participación</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900">Ingresos por Domo</h3>
                  <p className="text-xs text-slate-500">Distribución porcentual de ventas.</p>
                </div>

                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analyticsData?.domeOccupancy || []}
                        dataKey="revenue"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={4}
                      >
                        {(analyticsData?.domeOccupancy || []).map((entry: any, index: number) => (
                          <Cell key={`pie-cell-${index}`} fill={entry.color || '#10b981'} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff' }}
                        formatter={(val: any) => [`$${Number(val).toLocaleString('es-CO')} COP`, 'Ingresos']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                  {(analyticsData?.domeOccupancy || []).slice(0, 6).map((dome: any) => (
                    <div key={dome.id} className="flex items-center space-x-1.5 text-[11px] text-slate-600 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: dome.color }}></span>
                      <span className="truncate">{dome.shortName}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        )}

        {activeMenu === 'reservations' && (
          <ReservationsView reservations={reservations} domes={domes} ready={isReady} onStatus={handleUpdateStatus} onCollect={openCollect} onNew={() => setShowNewReservation(true)} />
        )}

        {activeMenu === 'calendar' && (
          <CalendarView reservations={reservations} domes={domes} maintenance={maintenance} ready={isReady} />
        )}

        {/* 4. DOMES VIEW */}
        {activeMenu === 'domes' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {domes.map(dome => (
                <div key={dome.id} className="glass-card p-6 rounded-2xl border border-slate-200 space-y-4">
                  <div className="relative rounded-xl overflow-hidden">
                    <ImageCarousel
                      images={getDomeImages(dome)}
                      alt={dome.name}
                      className="h-48"
                      overlayBadge={
                        <span className="bg-slate-900/80 backdrop-blur-md text-white text-xs px-3 py-1 rounded-full font-bold shadow-sm">
                          {dome.status}
                        </span>
                      }
                    />
                  </div>

                  <div>
                    <h4 className="text-lg font-bold text-slate-900">{dome.name}</h4>
                    <p className="text-xs text-slate-500">{dome.code} • ${dome.price_per_night?.toLocaleString('es-CO')} / noche</p>
                    <p className="text-xs text-slate-600 mt-2">{dome.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="glass-card p-6 rounded-2xl border border-slate-200 space-y-4">
              <h3 className="text-lg font-bold text-slate-900">Bloqueos de Mantenimiento Activos</h3>
              <div className="space-y-2">
                {maintenance.length === 0 ? (
                  <p className="text-sm text-slate-500">No hay bloqueos de mantenimiento registrados.</p>
                ) : (
                  maintenance.map(m => (
                    <div key={m.id} className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm flex justify-between items-center">
                      <div>
                        <strong>{m.dome_name}</strong>: Del {m.start_date} al {m.end_date} - Motivo: {m.reason}
                      </div>
                      <span className="text-xs text-amber-800 font-bold">Bloqueado</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeMenu === 'customers' && <GuestsView customers={customers} ready={isReady} />}

        {/* Finanzas */}
        {activeMenu === 'finances' && (
          !isReady ? <LoadingBlocks /> : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {[
                { label: 'Total reservado', value: finances?.totalBooked, cls: 'text-slate-900', span: 'col-span-2 sm:col-span-1' },
                { label: 'Ya cobrado', value: finances?.totalCollected, cls: 'text-emerald-700', span: '' },
                { label: 'Por cobrar', value: finances?.totalPending, cls: 'text-amber-600', span: '' },
              ].map(c => (
                <Card key={c.label} className={`p-5 ${c.span}`}>
                  <p className="text-sm font-semibold text-slate-500">{c.label}</p>
                  <p className={`text-2xl sm:text-3xl font-bold mt-1 ${c.cls}`}><CountUp value={Number(c.value) || 0} format={fmtCOP} /></p>
                </Card>
              ))}
            </div>

            <Card className="overflow-hidden">
              <div className="px-5 sm:px-6 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900">Pagos recibidos</h3>
              </div>
              {payments.length === 0 ? (
                <EmptyState icon={<Wallet className="w-7 h-7" />} title="Aún no hay pagos registrados" hint="Cuando cobres una reserva, el pago aparecerá aquí." />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {payments.map(p => (
                    <li key={p.id} className="px-5 sm:px-6 py-3.5 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0"><Wallet className="w-5 h-5" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 truncate">{p.customer_name} <span className="font-mono text-xs text-slate-400">{p.reservation_code}</span></p>
                        <p className="text-xs text-slate-500">{p.method} · {String(p.created_at).slice(0, 16)} · {p.recorded_by}</p>
                      </div>
                      <p className="font-bold text-emerald-700 shrink-0">{fmtCOP(p.amount)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          )
        )}

        {/* 7. AUDIT */}
        {activeMenu === 'audit' && (
          <div className="glass-card rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Registro de Auditoría y Trazabilidad</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-xs font-bold uppercase border-b border-slate-200">
                    <th className="p-4">Fecha / Hora</th>
                    <th className="p-4">Administrador</th>
                    <th className="p-4">Acción</th>
                    <th className="p-4">Objetivo</th>
                    <th className="p-4">Detalles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="p-4 text-xs text-slate-500 font-mono">{log.timestamp}</td>
                      <td className="p-4 font-bold text-slate-900">{log.user_name}</td>
                      <td className="p-4"><span className="px-2 py-1 rounded bg-slate-100 font-mono text-xs font-bold text-slate-700">{log.action}</span></td>
                      <td className="p-4 text-slate-600">{log.target_type} (#{log.target_id})</td>
                      <td className="p-4 text-slate-600 text-xs">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Accesos: quién puede entrar al panel */}
        {activeMenu === 'users' && user.role === 'SUPERADMIN' && (
          <TeamView staff={staff} ready={isReady} onAdd={handleAddStaff} onRemove={handleRemoveStaff} />
        )}

        {/* 9. IMAGES MANAGEMENT */}
        {activeMenu === 'images' && (
          <div className="space-y-6">
            <div className="glass-card p-6 rounded-2xl border border-slate-200 space-y-2">
              <h3 className="text-xl font-bold text-slate-900">📸 Gestión Sencilla de Imágenes</h3>
              <p className="text-sm text-slate-600">
                Cambia la foto de cualquier domo de forma inmediata pegando una nueva URL de imagen, seleccionando una de nuestras opciones preestablecidas o subiendo un archivo desde tu computador.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {domes.map(dome => (
                <div key={dome.id} className="glass-card p-5 rounded-2xl border border-slate-200 space-y-4 flex flex-col justify-between bg-white shadow-xs">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 text-sm">{dome.name}</h4>
                      <span className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        {dome.code}
                      </span>
                    </div>

                    <div className="relative rounded-xl overflow-hidden border border-slate-200">
                      <ImageCarousel
                        images={getDomeImages(dome)}
                        alt={dome.name}
                        className="h-44"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">URL de la Imagen</label>
                      <input
                        type="text"
                        defaultValue={dome.image_url}
                        id={`dome-img-input-${dome.id}`}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono text-slate-800"
                        placeholder="https://images.unsplash.com/..."
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="flex space-x-2">
                      <label className="flex-1 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2 px-3 rounded-xl text-center transition-colors">
                        📁 Subir archivo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const localUrl = URL.createObjectURL(file);
                              const inputEl = document.getElementById(`dome-img-input-${dome.id}`) as HTMLInputElement;
                              if (inputEl) inputEl.value = localUrl;
                              handleUpdateDomeImage(dome.id, localUrl);
                            }
                          }}
                          className="hidden"
                        />
                      </label>
                      
                      <button
                        onClick={() => {
                          const inputEl = document.getElementById(`dome-img-input-${dome.id}`) as HTMLInputElement;
                          if (inputEl) {
                            handleUpdateDomeImage(dome.id, inputEl.value);
                          }
                        }}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2 px-3 rounded-xl transition-colors shadow-sm"
                      >
                        💾 Guardar
                      </button>
                    </div>

                    <div className="flex gap-1.5 pt-1">
                      <button
                        onClick={() => {
                          const url = "https://images.unsplash.com/photo-1587061949409-02df41d5e562?auto=format&fit=crop&w=1200&q=80";
                          const inputEl = document.getElementById(`dome-img-input-${dome.id}`) as HTMLInputElement;
                          if (inputEl) inputEl.value = url;
                          handleUpdateDomeImage(dome.id, url);
                        }}
                        className="text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded-lg flex-1"
                      >
                        ✨ Jacuzzi
                      </button>
                      <button
                        onClick={() => {
                          const url = "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1200&q=80";
                          const inputEl = document.getElementById(`dome-img-input-${dome.id}`) as HTMLInputElement;
                          if (inputEl) inputEl.value = url;
                          handleUpdateDomeImage(dome.id, url);
                        }}
                        className="text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded-lg flex-1"
                      >
                        🌙 Cúpula
                      </button>
                      <button
                        onClick={() => {
                          const url = "https://images.unsplash.com/photo-1510798831971-661eb04b3739?auto=format&fit=crop&w=1200&q=80";
                          const inputEl = document.getElementById(`dome-img-input-${dome.id}`) as HTMLInputElement;
                          if (inputEl) inputEl.value = url;
                          handleUpdateDomeImage(dome.id, url);
                        }}
                        className="text-[10px] bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 px-2 py-1 rounded-lg flex-1"
                      >
                        🌲 Bosque
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RESTAURANTE / MENÚ DE COMIDAS */}
        {activeMenu === 'restaurant' && (
          <div className="space-y-6">
            <div className="glass-card p-6 rounded-2xl border border-slate-200 bg-white space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Gestión de Menú Chinauta Eco Glamping</h3>
                  <p className="text-xs text-slate-500">Configuración de platos, precios y acompañamientos para cenas y almuerzos.</p>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                  5 Platos Activos
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
                {CHINAUTA_MENU_ITEMS.map((item: any) => (
                  <div key={item.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div className="relative h-40 rounded-xl overflow-hidden">
                      <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
                      <span className="absolute top-2 left-2 bg-slate-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                        #{item.item_number} {item.category}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{item.title}</h4>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1">{item.description}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-xs space-y-1">
                      <div><strong className="text-slate-700">Preparaciones:</strong> {item.preparations.join(', ')}</div>
                      <div><strong className="text-slate-700">Incluye:</strong> {item.sides.join(' + ')}</div>
                      <div><strong className="text-slate-700">Bebida:</strong> {item.beverage}</div>
                    </div>
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-slate-500 font-medium">Precio al público:</span>
                      <span className="text-sm font-black text-emerald-700">${item.price.toLocaleString('es-CO')} COP</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 10. SETTINGS */}
        {activeMenu === 'settings' && (
          <div className="glass-card p-6 rounded-2xl border border-slate-200 space-y-6 max-w-2xl">
            <h3 className="text-lg font-bold text-slate-900">Configuración General del Glamping</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Nombre del Negocio</label>
                <input
                  type="text"
                  value={settings.glamping_name || 'Eco Glamping Chinauta'}
                  onChange={e => setSettings({...settings, glamping_name: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">WhatsApp de Contacto</label>
                <input
                  type="text"
                  value={settings.whatsapp || ''}
                  onChange={e => setSettings({...settings, whatsapp: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Correo Electrónico</label>
                <input
                  type="text"
                  value={settings.email || ''}
                  onChange={e => setSettings({...settings, email: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium"
                />
              </div>
              <button
                onClick={async () => {
                  await fetch('/api/settings', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(settings)
                  });
                  notify(t('admin.save'));
                }}
                className="px-6 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700"
              >
                {t('admin.save')}
              </button>
            </div>
          </div>
        )}

        </PageFade>
        </AnimatePresence>

      </main>

      {/* Navegación inferior (celular) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-950/95 backdrop-blur border-t border-white/10 pb-[env(safe-area-inset-bottom)]" aria-label="Menú del panel">
        <div className="flex items-stretch justify-around px-1">
          {visibleSections.map(section => {
            const Icon = section.icon;
            const isActive = section.id === currentSection.id;
            return (
              <button
                key={section.id}
                onClick={() => handleMenuSelect(section.views[0].id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex-1 min-w-0 flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors ${isActive ? 'text-emerald-300' : 'text-slate-400'}`}
              >
                {isActive && <motion.span layoutId="admin-bottom-pill" className="absolute top-0 h-0.5 w-8 rounded-full bg-emerald-400" transition={{ type: 'spring', stiffness: 450, damping: 38 }} />}
                <span className="relative">
                  <Icon className="w-6 h-6" />
                  {section.id === 'reservations' && pendingCount > 0 && <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold flex items-center justify-center">{pendingCount}</span>}
                </span>
                <span className="truncate max-w-full px-0.5">{t(section.shortKey || section.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Avisos */}
      <AnimatePresence>
        {toast && (
          <motion.div
            role="status" aria-live="polite"
            initial={{ opacity: 0, y: -16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className={`fixed z-[60] left-1/2 -translate-x-1/2 top-20 md:top-6 max-w-[90vw] px-5 py-3 rounded-2xl text-sm font-semibold shadow-xl text-white ${toast.kind === 'error' ? 'bg-rose-600' : 'bg-slate-900'}`}
          >
            {toast.kind === 'error' ? '⚠️ ' : '✓ '}{toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nueva reserva hecha por el equipo */}
      <AnimatePresence>
        {showNewReservation && (
          <NewReservationModal
            domes={domes} staffName={user.full_name}
            onClose={() => setShowNewReservation(false)}
            onCreated={code => { setShowNewReservation(false); notify(`Reserva ${code} creada`); loadData(['reservations', 'domes']); }}
          />
        )}
      </AnimatePresence>

      {/* Bloquear fechas por mantenimiento */}
      <AnimatePresence>
        {showMaintenanceModal && (
          <Modal title="Bloquear fechas de un domo" subtitle="Nadie podrá reservar ese domo en esos días." onClose={() => setShowMaintenanceModal(false)}>
            <form onSubmit={handleCreateMaintenance} className="space-y-4">
              <div>
                <label className={labelClass} htmlFor="maint-dome">Domo</label>
                <select id="maint-dome" value={maintDomeId} onChange={e => setMaintDomeId(Number(e.target.value))} className={fieldClass}>
                  {domes.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass} htmlFor="maint-from">Desde</label>
                  <input id="maint-from" type="date" value={maintStart} onChange={e => setMaintStart(e.target.value)} className={fieldClass} required />
                </div>
                <div>
                  <label className={labelClass} htmlFor="maint-to">Hasta</label>
                  <input id="maint-to" type="date" value={maintEnd} min={maintStart} onChange={e => setMaintEnd(e.target.value)} className={fieldClass} required />
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor="maint-reason">Motivo</label>
                <input id="maint-reason" type="text" value={maintReason} onChange={e => setMaintReason(e.target.value)} className={fieldClass} required />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowMaintenanceModal(false)} className="flex-1 h-12 rounded-2xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
                <button type="submit" className="flex-1 h-12 rounded-2xl bg-slate-900 text-white font-semibold hover:bg-slate-800 egc-press">Bloquear fechas</button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

      {/* Registrar un pago */}
      <AnimatePresence>
        {showPaymentModal && (
          <Modal
            title="Registrar pago"
            subtitle={payingRes ? `${payingRes.customer_name} · ${payingRes.dome_name} · ${payingRes.reservation_code}` : undefined}
            onClose={() => setShowPaymentModal(false)}
          >
            <form onSubmit={handleRecordPayment} className="space-y-4">
              {payingRes && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[['Total', payingRes.total_amount, 'text-slate-900'], ['Pagado', payingRes.amount_paid, 'text-emerald-700'], ['Falta', payingRes.amount_pending, 'text-amber-700']].map(([l, v, c]) => (
                    <div key={l as string} className="rounded-2xl bg-slate-50 py-2.5">
                      <p className="text-[11px] font-semibold text-slate-500 uppercase">{l as string}</p>
                      <p className={`font-bold ${c}`}>{fmtCOP(v as number)}</p>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <label className={labelClass} htmlFor="pay-amount">¿Cuánto pagó? (COP)</label>
                <input id="pay-amount" type="number" inputMode="numeric" min={1} value={payAmount || ''} onChange={e => setPayAmount(Number(e.target.value))} className={`${fieldClass} font-bold`} required autoFocus />
                {payingRes && payingRes.amount_pending > 0 && payAmount !== payingRes.amount_pending && (
                  <button type="button" onClick={() => setPayAmount(payingRes.amount_pending)} className="mt-2 text-sm font-semibold text-emerald-700 hover:underline">
                    Poner el saldo completo ({fmtCOP(payingRes.amount_pending)})
                  </button>
                )}
              </div>
              <div>
                <span className={labelClass}>Método de pago</span>
                <div className="grid grid-cols-2 gap-2">
                  {['Transferencia Bancaria', 'Efectivo', 'Wompi', 'Datáfono'].map(m => (
                    <button
                      key={m} type="button" onClick={() => setPayMethod(m)} aria-pressed={payMethod === m}
                      className={`h-11 rounded-2xl border text-sm font-semibold transition-colors ${payMethod === m ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      {m === 'Transferencia Bancaria' ? 'Transferencia' : m}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="flex-1 h-12 rounded-2xl border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
                <button type="submit" className="flex-[1.4] h-12 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 egc-press">Registrar {payAmount ? fmtCOP(payAmount) : 'pago'}</button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>

    </div>
  );
};
