import React, { useEffect, useState } from 'react';
import { loadAnalyticsIfConsented } from './lib/analytics';
import { signOut } from 'firebase/auth';
import { auth } from './lib/firebase';
import { Navbar } from './components/Navbar';
import { HomePortal } from './components/HomePortal';
import { AvailabilityChecker } from './components/AvailabilityChecker';
import { ContactView } from './components/ContactView';
import { InteractiveMap } from './components/InteractiveMap';
import { FoodMenuSection } from './components/FoodMenuSection';
import { FAQSection } from './components/FAQSection';
import { DecorationsSection } from './components/DecorationsSection';
import { BookingWizardModal } from './components/BookingWizardModal';
import { MyReservationsModal } from './components/MyReservationsModal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminDashboard } from './components/AdminDashboard';
import { AiConciergeChat } from './components/AiConciergeChat';
import { LegalView, LegalSection, readLegalParam } from './components/LegalView';
import { CookieBanner } from './components/CookieBanner';
import { AdminUser } from './types';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { useDynamicSEO } from './utils/seoConfig';

function AppContent() {
  const { t, language } = useLanguage();
  // Links such as /?legal=terminos open the legal page directly (used by the booking form).
  const [activeTab, setActiveTab] = useState(() => (readLegalParam() ? 'legal' : 'home'));
  const [legalSection, setLegalSection] = useState<LegalSection>(() => readLegalParam() || 'privacidad');

  // Returning visitors who already accepted analytics: load it on arrival (does nothing otherwise).
  useEffect(() => { loadAnalyticsIfConsented(); }, []);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  // Centralized Dynamic SEO Configuration Utility
  useDynamicSEO(adminUser ? 'admin' : activeTab);

  // Modals
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [bookingDomeId, setBookingDomeId] = useState<number | undefined>(undefined);
  const [bookingCheckIn, setBookingCheckIn] = useState<string | undefined>(undefined);
  const [bookingCheckOut, setBookingCheckOut] = useState<string | undefined>(undefined);

  const [isMyReservationsOpen, setIsMyReservationsOpen] = useState(false);
  const [isAdminLoginOpen, setIsAdminLoginOpen] = useState(false);

  const openLegal = (section: LegalSection) => {
    setLegalSection(section);
    setActiveTab('legal');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenBooking = (domeId?: number) => {
    setBookingDomeId(domeId);
    setBookingCheckIn(undefined);
    setBookingCheckOut(undefined);
    setIsBookingOpen(true);
  };

  const handleOpenBookingWithDates = (checkIn: string, checkOut: string, domeId: number) => {
    setBookingCheckIn(checkIn);
    setBookingCheckOut(checkOut);
    setBookingDomeId(domeId);
    setIsBookingOpen(true);
  };

  // If admin is logged in, show admin dashboard
  if (adminUser) {
    return (
      <AdminDashboard
        user={adminUser}
        onLogout={() => { setAdminUser(null); signOut(auth).catch(() => {}); }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
      
      {/* Navbar with Language Switcher */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenBooking={() => handleOpenBooking()}
        onOpenAdminLogin={() => setIsAdminLoginOpen(true)}
        onOpenMyReservations={() => setIsMyReservationsOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 pb-20 lg:pb-0 overflow-x-hidden">
        {activeTab === 'home' && (
          <HomePortal
            onOpenBooking={handleOpenBooking}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'availability' && (
          <AvailabilityChecker
            onOpenBookingWithDates={handleOpenBookingWithDates}
          />
        )}

        {activeTab === 'domes' && (
          <HomePortal
            onOpenBooking={handleOpenBooking}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'faq' && (
          <FAQSection />
        )}

        {activeTab === 'contact' && (
          <ContactView />
        )}

        {activeTab === 'map' && (
          <InteractiveMap />
        )}

        {activeTab === 'menu' && (
          <FoodMenuSection onOpenBooking={handleOpenBooking} />
        )}

        {activeTab === 'decoraciones' && (
          <DecorationsSection onOpenBooking={handleOpenBooking} />
        )}

        {activeTab === 'legal' && (
          <LegalView key={legalSection} initialSection={legalSection} />
        )}
      </div>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-12 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center overflow-hidden border border-slate-800">
                <img src="/logo.jpg" alt="Eco Glamping Chinauta" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <span className="font-bold text-white text-base">Eco Glamping Chinauta</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {t('footer.brand_desc')}
            </p>
          </div>

          <div>
            <h4 className="font-bold text-white text-sm mb-3">{t('footer.domes_title')}</h4>
            <ul className="space-y-2 text-xs">
              <li>{language === 'en' ? 'Dome' : 'Domo'} 1 — Huitaca</li>
              <li>{language === 'en' ? 'Dome' : 'Domo'} 2 — Bochica</li>
              <li>{language === 'en' ? 'Dome' : 'Domo'} 3 — Bachué</li>
              <li>{language === 'en' ? 'Dome' : 'Domo'} 4 — Luna Chía</li>
              <li>{language === 'en' ? 'Dome' : 'Domo'} 5 — Chiminichagua</li>
              <li>{language === 'en' ? 'Dome' : 'Domo'} 6 — Xue Sol</li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white text-sm mb-3">{t('footer.links_title')}</h4>
            <ul className="space-y-2 text-xs">
              <li><button onClick={() => setActiveTab('home')} className="hover:text-emerald-400">{t('nav.home')}</button></li>
              <li><button onClick={() => setActiveTab('availability')} className="hover:text-emerald-400">{t('nav.availability')}</button></li>
              <li><button onClick={() => setActiveTab('faq')} className="hover:text-emerald-400">{t('nav.faq')}</button></li>
              <li><button onClick={() => setActiveTab('map')} className="hover:text-emerald-400">{t('nav.map')}</button></li>
              <li><button onClick={() => setIsMyReservationsOpen(true)} className="hover:text-emerald-400">{t('nav.my_reservations')}</button></li>
              <li><button onClick={() => setIsAdminLoginOpen(true)} className="hover:text-emerald-400">{t('nav.admin')}</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white text-sm mb-3">Legal</h4>
            <ul className="space-y-2 text-xs">
              <li><button onClick={() => openLegal('privacidad')} className="hover:text-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded">Política de privacidad</button></li>
              <li><button onClick={() => openLegal('terminos')} className="hover:text-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded">Términos y condiciones</button></li>
              <li><button onClick={() => openLegal('reembolsos')} className="hover:text-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded">Reembolsos y cancelaciones</button></li>
              <li><button onClick={() => openLegal('cookies')} className="hover:text-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded">Cookies</button></li>
              <li><button onClick={() => openLegal('derechos')} className="hover:text-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded">Derechos de autor</button></li>
              <li><button onClick={() => openLegal('mis-datos')} className="hover:text-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 rounded">Descargar o borrar mis datos</button></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-white text-sm mb-3">{t('footer.contact_title')}</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Vía Principal Chinauta Km 4.5<br />
              Fusagasugá, Cundinamarca, Colombia<br />
              WhatsApp: +57 321 310 9331 / +57 310 123 4567<br />
              contacto@ecoglampingchinauta.com
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 pt-8 border-t border-slate-900 text-center text-xs text-slate-500">
          {t('footer.copyright')}
        </div>
      </footer>

      {/* Floating AI Concierge Chatbot */}
      <AiConciergeChat />

      {/* Cookie notice */}
      <CookieBanner onOpenCookiePolicy={() => openLegal('cookies')} />

      {/* Booking Wizard Modal */}
      <BookingWizardModal
        isOpen={isBookingOpen}
        onClose={() => setIsBookingOpen(false)}
        initialDomeId={bookingDomeId}
        initialCheckIn={bookingCheckIn}
        initialCheckOut={bookingCheckOut}
        onSuccess={(code) => {
          // Success callback
        }}
      />

      {/* My Reservations Modal */}
      <MyReservationsModal
        isOpen={isMyReservationsOpen}
        onClose={() => setIsMyReservationsOpen(false)}
      />

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={isAdminLoginOpen}
        onClose={() => setIsAdminLoginOpen(false)}
        onLoginSuccess={(user) => setAdminUser(user)}
      />

    </div>
  );
}

export function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

export default App;
