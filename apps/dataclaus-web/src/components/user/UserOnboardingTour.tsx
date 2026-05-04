'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Sparkle, ArrowRight, X } from 'phosphor-react';

const STORAGE_KEY = 'user_onboarded_v1';

interface Slide {
  title: string;
  body: string;
  icon: React.ElementType;
}

const slides: Slide[] = [
  {
    title: 'Hoş geldin',
    body: 'Verilerinin bir bedeli var. Kullandığın uygulamalar üzerinden kazanç payın doğrudan cüzdanına gelir.',
    icon: Sparkle,
  },
  {
    title: 'Nasıl çalışır?',
    body: 'Bağlı uygulamalardaki reklam gelirinin %50–%90&apos;ı (yayıncının ayarına göre) sana ödenir. Platform sadece %5 alır.',
    icon: Sparkle,
  },
  {
    title: 'İlk uygulamanı bağla',
    body: 'TikTok klonu gibi DataClaus SDK&apos;sini kullanan bir uygulamaya giriş yap. Aynı hesap, tek cüzdan.',
    icon: Sparkle,
  },
];

export function UserOnboardingTour() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (!seen) setOpen(true);
  }, []);

  const finish = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, '1');
    }
    setOpen(false);
  };

  const next = () => {
    if (step < slides.length - 1) setStep(step + 1);
    else finish();
  };

  const slide = slides[step];
  const Icon = slide.icon;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ scale: 0.96, y: 16, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: 16, opacity: 0 }}
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                <Sparkle size={14} weight="fill" className="text-amber-500" />
                Tanıtım · {step + 1}/{slides.length}
              </div>
              <button
                aria-label="Skip"
                onClick={finish}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-8 space-y-4 text-center">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center">
                <Icon size={28} weight="fill" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                {slide.title}
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed">
                {slide.body}
              </p>
            </div>
            <div className="flex items-center justify-between gap-3 p-4 border-t border-slate-100 bg-slate-50">
              <Button variant="ghost" size="sm" onClick={finish}>
                Skip
              </Button>
              <Button size="sm" onClick={next}>
                {step === slides.length - 1 ? 'Get started' : 'Next'}
                <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
