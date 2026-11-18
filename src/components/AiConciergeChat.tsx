import React, { useState } from 'react';
import { X, Send, Bot, Sparkles } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface Message {
  sender: 'ai' | 'user';
  text: string;
}

export const AiConciergeChat: React.FC = () => {
  const { t, language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'ai', text: t('chat.welcome_msg') }
  ]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { sender: 'ai', text: data.reply || t('chat.fallback_msg') }]);
    } catch (err) {
      setMessages(prev => [...prev, { sender: 'ai', text: t('chat.error_msg') }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-[calc(4.25rem+16px)] lg:bottom-6 right-4 sm:right-6 z-50">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          aria-label={t('chat.virtual_assistant')}
          className="flex items-center justify-center sm:space-x-2 w-12 h-12 sm:w-auto sm:h-auto sm:px-5 sm:py-3.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-xl shadow-emerald-700/30 hover:scale-105 transition-transform"
        >
          <Sparkles className="w-5 h-5 animate-pulse" />
          <span className="hidden sm:inline font-semibold text-sm">{t('chat.virtual_assistant')}</span>
        </button>
      ) : (
        <div className="w-[calc(100vw-2rem)] max-w-sm sm:w-96 glass-card rounded-2xl shadow-2xl border border-emerald-200 overflow-hidden flex flex-col h-[480px] max-h-[75vh]">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-700 to-teal-800 text-white p-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">{t('chat.concierge_title')}</h3>
                <p className="text-[10px] uppercase tracking-wide text-emerald-100">{language === 'en' ? 'AI assistant' : 'Asistente con IA'}</p>
                <p className="text-xs text-emerald-200 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span> {t('chat.online')}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/70 text-sm">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-2xl ${
                    m.sender === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-xs'
                      : 'bg-white text-slate-800 shadow-xs border border-slate-200 rounded-bl-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.text}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl border border-slate-200 text-slate-500 text-xs flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce"></div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={t('chat.input_placeholder')}
              className="flex-1 px-4 py-2 text-sm rounded-xl border border-slate-200 focus:outline-hidden focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
