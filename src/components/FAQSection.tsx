import React, { useState } from 'react';
import { HelpCircle, ChevronDown, Sparkles, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '../context/LanguageContext';
import { useDynamicSEO } from '../utils/seoConfig';

export const FAQSection: React.FC = () => {
  useDynamicSEO('faq');
  const { t } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: t('faq.item1_q'),
      a: t('faq.item1_a')
    },
    {
      q: t('faq.item2_q'),
      a: t('faq.item2_a')
    },
    {
      q: t('faq.item3_q'),
      a: t('faq.item3_a')
    },
    {
      q: t('faq.item4_q'),
      a: t('faq.item4_a')
    },
    {
      q: t('faq.item5_q'),
      a: t('faq.item5_a')
    },
    {
      q: t('faq.item6_q'),
      a: t('faq.item6_a')
    }
  ];

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12"
    >
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold uppercase tracking-wider">
          <HelpCircle className="w-4 h-4 text-emerald-600" />
          <span>{t('faq.badge')}</span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight">
          {t('faq.title')}
        </h2>
        <p className="text-slate-600 text-base leading-relaxed">
          {t('faq.desc')}
        </p>
      </div>

      {/* FAQ Accordion List */}
      <div className="space-y-4 max-w-3xl mx-auto">
        {faqs.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={idx}
              className={`glass-card rounded-2xl border transition-all overflow-hidden ${
                isOpen ? 'border-emerald-300 shadow-lg bg-white' : 'border-slate-200/90 bg-white/80 hover:border-slate-300'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleAccordion(idx)}
                className="w-full flex items-center justify-between p-6 text-left cursor-pointer focus:outline-hidden"
              >
                <div className="flex items-center space-x-3.5 pr-4">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                    isOpen ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    <HelpCircle className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-slate-900 text-base sm:text-lg">{faq.q}</span>
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-slate-100 text-slate-600 transition-transform duration-200 shrink-0 ${
                  isOpen ? 'rotate-180 bg-emerald-100 text-emerald-800' : ''
                }`}>
                  <ChevronDown className="w-4 h-4" />
                </div>
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                  >
                    <div className="px-6 pb-6 pt-1 text-slate-600 text-sm sm:text-base leading-relaxed border-t border-slate-100">
                      {faq.a}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Support CTA Footer */}
      <div className="max-w-3xl mx-auto bg-gradient-to-br from-emerald-900 via-emerald-950 to-slate-900 rounded-3xl p-8 sm:p-10 text-white shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
        <div className="space-y-2">
          <h4 className="text-xl font-bold">{t('faq.more_help_title')}</h4>
          <p className="text-slate-300 text-sm max-w-lg">{t('faq.more_help_desc')}</p>
        </div>
        <a
          href="https://wa.me/573242969426?text=Hola,%20tengo%20una%20consulta%20sobre%20Eco%20Glamping%20Chinauta"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center space-x-2 px-6 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/50 transition-all shrink-0"
        >
          <MessageCircle className="w-5 h-5" />
          <span>{t('faq.whatsapp_btn')}</span>
        </a>
      </div>
    </motion.div>
  );
};
