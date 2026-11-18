import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar, Compass, Phone, Shield, Search, Home, Utensils, 
  Menu, X, ChevronDown, MapPin, Sparkles, Waves, Clock, 
  MessageSquare, ChevronRight, ExternalLink, HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSwitcher } from './LanguageSwitcher';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenBooking: () => void;
  onOpenAdminLogin: () => void;
  onOpenMyReservations: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenBooking,
  onOpenAdminLogin,
  onOpenMyReservations
}) => {
  const { t, language } = useLanguage();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // La barra superior gana sombra y se vuelve más compacta al bajar por la página.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const [isAvailableMenuOpen, setIsAvailableMenuOpen] = useState(false);
  const [isExplorarDropdownOpen, setIsExplorarDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsExplorarDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile menu on tab switch or ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMobileMenuOpen(false);
        setIsExplorarDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavClick = (tab: string) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
    setIsExplorarDropdownOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <header className={`sticky top-0 z-40 backdrop-blur-md border-b border-slate-200/90 transition-[background-color,box-shadow] duration-500 ${scrolled ? 'bg-white/90 shadow-lg shadow-slate-900/5' : 'bg-white/95 shadow-xs'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            
            {/* Logo & Brand */}
            <div 
              className="flex min-w-0 items-center space-x-3 cursor-pointer group select-none" 
              onClick={() => handleNavClick('home')}
            >
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white flex items-center justify-center shadow-md shadow-slate-300/40 relative overflow-hidden border border-slate-200 group-hover:scale-105 transition-transform">
                <picture>
                  <source srcSet="/logo.webp" type="image/webp" />
                  <img 
                    src="/logo.webp" 
                    alt="Eco Glamping Chinauta Logo" 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = '/logo.jpg';
                    }}
                  />
                </picture>
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5">
                  <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 group-hover:text-emerald-700 transition-colors">
                    CHINAUTA
                  </span>
                  <span className="hidden min-[400px]:inline-block lg:hidden xl:inline-block text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 tracking-wider">
                    ECO GLAMPING
                  </span>
                </div>
                <p className="truncate text-[10px] sm:text-[11px] text-slate-500 font-medium tracking-widest uppercase">
                  Fusagasugá • Colombia
                </p>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden lg:flex items-center space-x-1 xl:space-x-1.5 2xl:space-x-2">
              <button
                onClick={() => handleNavClick('home')}
                className={`px-2.5 xl:px-3.5 py-2 rounded-lg text-[13px] xl:text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === 'home'
                    ? 'bg-emerald-50 text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                {t('nav.home')}
              </button>

              <button
                onClick={() => handleNavClick('availability')}
                className={`px-2.5 xl:px-3.5 py-2 rounded-lg text-[13px] xl:text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === 'availability'
                    ? 'bg-emerald-50 text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                {t('nav.availability')}
              </button>

              <button
                onClick={() => handleNavClick('domes')}
                className={`px-2.5 xl:px-3.5 py-2 rounded-lg text-[13px] xl:text-sm font-medium whitespace-nowrap transition-all flex items-center space-x-1 ${
                  activeTab === 'domes'
                    ? 'bg-emerald-50 text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <span>{t('nav.domes')}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">6</span>
              </button>



              <button
                onClick={() => handleNavClick('contact')}
                className={`px-2.5 xl:px-3.5 py-2 rounded-lg text-[13px] xl:text-sm font-medium whitespace-nowrap transition-all ${
                  activeTab === 'contact'
                    ? 'bg-emerald-50 text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                {t('nav.contact')}
              </button>

              {/* Elegant Dropdown: Explorar */}
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsExplorarDropdownOpen(!isExplorarDropdownOpen)}
                  className={`px-2.5 xl:px-3.5 py-2 rounded-lg text-[13px] xl:text-sm font-medium whitespace-nowrap transition-all flex items-center space-x-1 ${
                    isExplorarDropdownOpen || activeTab === 'map'
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <span>{t('nav.explore')}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExplorarDropdownOpen ? 'rotate-180 text-emerald-600' : ''}`} />
                </button>

                <AnimatePresence>
                  {isExplorarDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.96 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-2.5 z-50 overflow-hidden"
                    >
                      <button
                        onClick={() => handleNavClick('menu')}
                        className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 flex items-start space-x-3 transition-colors group"
                      >
                        <div className="p-2 rounded-lg bg-amber-100/80 text-amber-700 group-hover:bg-amber-200 transition-colors">
                          <Utensils className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{t('nav.menu')}</p>
                          <p className="text-xs text-slate-500">{language === 'en' ? 'Food and drinks' : 'Comida y bebidas'}</p>
                        </div>
                      </button>

                      <button
                        onClick={() => handleNavClick('decoraciones')}
                        className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 flex items-start space-x-3 transition-colors group"
                      >
                        <div className="p-2 rounded-lg bg-rose-100/80 text-rose-700 group-hover:bg-rose-200 transition-colors">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{language === 'en' ? 'Decorations' : 'Decoraciones'}</p>
                          <p className="text-xs text-slate-500">{language === 'en' ? 'VIP decoration for your stay' : 'Decoración VIP para tu estadía'}</p>
                        </div>
                      </button>

                      <div className="border-t border-slate-100 my-1" />

                      <button
                        onClick={() => handleNavClick('map')}
                        className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 flex items-start space-x-3 transition-colors group"
                      >
                        <div className="p-2 rounded-lg bg-emerald-100/80 text-emerald-700 group-hover:bg-emerald-200 transition-colors">
                          <MapPin className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{t('nav.map')}</p>
                          <p className="text-xs text-slate-500">{t('nav.map_desc')}</p>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          handleNavClick('home');
                          setTimeout(() => {
                            const el = document.getElementById('experiencia-section');
                            el?.scrollIntoView({ behavior: 'smooth' });
                          }, 150);
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 flex items-start space-x-3 transition-colors group"
                      >
                        <div className="p-2 rounded-lg bg-teal-100/80 text-teal-700 group-hover:bg-teal-200 transition-colors">
                          <Waves className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{t('nav.jacuzzi_climate')}</p>
                          <p className="text-xs text-slate-500">{t('nav.jacuzzi_desc')}</p>
                        </div>
                      </button>

                      <button
                        onClick={() => handleNavClick('faq')}
                        className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 flex items-start space-x-3 transition-colors group"
                      >
                        <div className="p-2 rounded-lg bg-cyan-100/80 text-cyan-700 group-hover:bg-cyan-200 transition-colors">
                          <HelpCircle className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{t('nav.faq')}</p>
                          <p className="text-xs text-slate-500">{t('faq.badge')}</p>
                        </div>
                      </button>

                      <div className="border-t border-slate-100 my-1" />

                      <a
                        href="https://wa.me/573213109331?text=Hola,%20deseo%20informaci%C3%B3n%20sobre%20Eco%20Glamping%20Chinauta"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full text-left px-4 py-2.5 hover:bg-emerald-50 flex items-start space-x-3 transition-colors group"
                      >
                        <div className="p-2 rounded-lg bg-emerald-500 text-white group-hover:bg-emerald-600 transition-colors">
                          <MessageSquare className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 flex items-center space-x-1">
                            <span>{t('nav.whatsapp_direct')}</span>
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                          </p>
                          <p className="text-xs text-slate-500">+57 321 310 9331</p>
                        </div>
                      </a>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </nav>

            {/* Desktop Actions (visible on md+) */}
            <div className="hidden lg:flex items-center space-x-2 xl:space-x-3">
              {/* Language Switcher */}
              <LanguageSwitcher variant="compact" />

              <button
                onClick={onOpenMyReservations}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-100/85 transition-colors border border-slate-200 shadow-2xs"
              >
                <Search className="w-4 h-4 text-emerald-600" />
                <span className="hidden xl:inline">{t('nav.my_reservations')}</span>
              </button>

              <button
                onClick={onOpenBooking}
                className="px-4 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 shadow-md shadow-emerald-600/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                {t('nav.book')}
              </button>

              <button
                onClick={onOpenAdminLogin}
                title={t('nav.admin')}
                className="p-2 rounded-xl text-slate-600 hover:text-emerald-700 hover:bg-slate-100 border border-slate-200 transition-colors"
              >
                <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            {/* Mobile & Tablet Hamburger Button (visible below md) */}
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:hidden">
              {/* In very narrow phones the language switcher lives inside the menu (see below). */}
              <div className="hidden min-[480px]:block">
                <LanguageSwitcher variant="compact" className="scale-90 origin-right" />
              </div>

              <button
                onClick={onOpenBooking}
                className="px-2.5 sm:px-3 py-2 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-700 shadow-sm"
              >
                {t('nav.book')}
              </button>

              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                aria-label={isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú desplegable'}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors border border-slate-300/80 shadow-xs active:scale-95"
              >
                {isMobileMenuOpen ? (
                  <X className="w-5 h-5 text-emerald-700" />
                ) : (
                  <Menu className="w-5 h-5 text-slate-800" />
                )}
              </button>
            </div>

          </div>
        </div>

        {/* Elegant Mobile / Tablet Full Dropdown Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="lg:hidden border-t border-slate-200/90 bg-white/98 backdrop-blur-xl shadow-2xl overflow-y-auto max-h-[calc(100vh-5rem)]"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4">
                
                {/* Language: the header shows it only from 480px up */}
                <LanguageSwitcher variant="full" className="min-[480px]:hidden" />

                {/* Primary Action Buttons */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsAvailableMenuOpen(false);
                      onOpenBooking();
                    }}
                    className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-700 shadow-md shadow-emerald-700/20 flex items-center justify-center space-x-1.5 active:scale-98"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>{t('nav.book_now')}</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsAvailableMenuOpen(false);
                      onOpenMyReservations();
                    }}
                    className="w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center space-x-1.5 active:scale-98"
                  >
                    <Search className="w-4 h-4 text-emerald-600" />
                    <span>{t('nav.my_reservations')}</span>
                  </button>
                </div>

                {/* Collapsible Available Menu Dropdown (Closed by default) */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAvailableMenuOpen(prev => !prev)}
                    className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-800 font-bold text-sm transition-all"
                  >
                    <div className="flex items-center space-x-2.5">
                      <Menu className="w-5 h-5 text-emerald-600" />
                      <span>{t('nav.available_menu')}</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${isAvailableMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isAvailableMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="space-y-1 pt-2 overflow-hidden"
                      >
                        <button
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            setIsAvailableMenuOpen(false);
                            handleNavClick('home');
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-medium transition-colors ${
                            activeTab === 'home' ? 'bg-emerald-100/70 text-emerald-900 font-bold' : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <Home className="w-5 h-5 text-emerald-600" />
                            <span>{t('nav.home')}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </button>

                        <button
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            setIsAvailableMenuOpen(false);
                            handleNavClick('availability');
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-medium transition-colors ${
                            activeTab === 'availability' ? 'bg-emerald-100/70 text-emerald-900 font-bold' : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <Calendar className="w-5 h-5 text-emerald-600" />
                            <span>{t('nav.availability')}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </button>

                        <button
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            setIsAvailableMenuOpen(false);
                            handleNavClick('domes');
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-medium transition-colors ${
                            activeTab === 'domes' ? 'bg-emerald-100/70 text-emerald-900 font-bold' : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <Compass className="w-5 h-5 text-emerald-600" />
                            <span>{t('nav.domes')}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </button>

                        <button
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            setIsAvailableMenuOpen(false);
                            handleNavClick('menu');
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-medium transition-colors ${
                            activeTab === 'menu' ? 'bg-emerald-100/70 text-emerald-900 font-bold' : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <Utensils className="w-5 h-5 text-emerald-600" />
                            <span>{t('nav.menu')}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </button>

                        <button
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            setIsAvailableMenuOpen(false);
                            handleNavClick('decoraciones');
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-medium transition-colors ${
                            activeTab === 'decoraciones' ? 'bg-emerald-100/70 text-emerald-900 font-bold' : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <Sparkles className="w-5 h-5 text-emerald-600" />
                            <span>{language === 'en' ? 'Decorations' : 'Decoraciones'}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </button>

                        <button
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            setIsAvailableMenuOpen(false);
                            handleNavClick('map');
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-medium transition-colors ${
                            activeTab === 'map' ? 'bg-emerald-100/70 text-emerald-900 font-bold' : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <MapPin className="w-5 h-5 text-emerald-600" />
                            <span>{t('nav.map')}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </button>

                        <button
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            setIsAvailableMenuOpen(false);
                            handleNavClick('contact');
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-medium transition-colors ${
                            activeTab === 'contact' ? 'bg-emerald-100/70 text-emerald-900 font-bold' : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <Phone className="w-5 h-5 text-emerald-600" />
                            <span>{t('nav.contact')}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </button>

                        <button
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            setIsAvailableMenuOpen(false);
                            handleNavClick('faq');
                          }}
                          className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-medium transition-colors ${
                            activeTab === 'faq' ? 'bg-emerald-100/70 text-emerald-900 font-bold' : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <HelpCircle className="w-5 h-5 text-emerald-600" />
                            <span>{t('nav.faq')}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </button>

                        <button
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            setIsAvailableMenuOpen(false);
                            onOpenAdminLogin();
                          }}
                          className="w-full flex items-center justify-between p-3 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          <div className="flex items-center space-x-3">
                            <Shield className="w-5 h-5 text-slate-500" />
                            <span>{t('nav.admin')}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Direct Telephone Link */}
                <div className="pt-2 border-t border-slate-200">
                  <a
                    href="tel:+573213109331"
                    className="flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
                  >
                    <Phone className="w-4 h-4 text-emerald-400" />
                    <span>{t('nav.call_reception')}</span>
                  </a>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Mobile Bottom Navigation Bar for Mobile Phones */}
      <nav aria-label="Navegación móvil inferior" className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-2 py-2 flex items-center justify-around shadow-xl">
        <button
          onClick={() => handleNavClick('home')}
          className={`flex flex-col items-center py-1 px-2 rounded-xl text-[11px] font-semibold transition-colors ${activeTab === 'home' ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600'}`}
        >
          <Home className="w-5 h-5 mb-0.5" />
          <span>{t('nav.home')}</span>
        </button>

        <button
          onClick={() => handleNavClick('availability')}
          className={`flex flex-col items-center py-1 px-2 rounded-xl text-[11px] font-semibold transition-colors ${activeTab === 'availability' ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600'}`}
        >
          <Calendar className="w-5 h-5 mb-0.5" />
          <span>{t('nav.dates')}</span>
        </button>

        <button
          onClick={() => handleNavClick('domes')}
          className={`flex flex-col items-center justify-center py-1.5 px-2 min-h-[44px] min-w-[44px] rounded-xl text-[11px] font-semibold transition-colors ${activeTab === 'domes' ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600'}`}
        >
          <Compass className="w-5 h-5 mb-0.5" />
          <span>{t('nav.domes')}</span>
        </button>

        <button
          onClick={() => handleNavClick('menu')}
          className={`flex flex-col items-center justify-center py-1.5 px-2 min-h-[44px] min-w-[44px] rounded-xl text-[11px] font-semibold transition-colors ${activeTab === 'menu' ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600'}`}
        >
          <Utensils className="w-5 h-5 mb-0.5 text-emerald-600" />
          <span>{t('nav.menu_short')}</span>
        </button>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={`flex flex-col items-center justify-center py-1.5 px-2 min-h-[44px] min-w-[44px] rounded-xl text-[11px] font-semibold transition-colors ${isMobileMenuOpen ? 'text-emerald-700 bg-emerald-50' : 'text-slate-600'}`}
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span>{t('nav.more') || (activeTab === 'home' ? 'Más' : 'Menú')}</span>
        </button>
      </nav>
    </>
  );
};

