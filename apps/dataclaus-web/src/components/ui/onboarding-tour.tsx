'use client';

import { useState, useEffect, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { 
  Question, 
  X, 
  ArrowRight, 
  ArrowLeft,
  Rocket,
  Code,
  Key,
  ChartBar,
  CheckCircle,
  Sparkle,
} from 'phosphor-react';
import Link from 'next/link';

interface TourStep {
  title: string;
  description: string;
  icon: React.ElementType;
  highlight?: string;
}

const tourSteps: TourStep[] = [
  {
    title: "Welcome to DataClaus!",
    description: "We're excited to have you here. Let's take a quick tour to help you get started with our platform and understand how everything works.",
    icon: Rocket,
  },
  {
    title: "Create Your First App",
    description: "Head to the Applications section to register your first app. You'll receive a unique App ID that you'll use to integrate our SDK into your mobile or web application.",
    icon: Code,
    highlight: '/dashboard/my-apps'
  },
  {
    title: "Generate API Keys",
    description: "Secure API keys are essential for authentication. Generate your keys in the API Keys section and keep them safe. Never expose them in client-side code!",
    icon: Key,
    highlight: '/dashboard/api-keys'
  },
  {
    title: "Integrate the SDK",
    description: "Check out our SDK Documentation for step-by-step integration guides. We support React Native, Node.js, and Web platforms with easy-to-follow examples.",
    icon: Code,
    highlight: '/dashboard/docs'
  },
  {
    title: "Monitor Your Data",
    description: "Once integrated, you'll see real-time analytics on your dashboard. Track data quality, revenue, and user engagement all in one place.",
    icon: ChartBar,
    highlight: '/dashboard'
  },
  {
    title: "You're All Set! 🚀",
    description: "That's the basics! If you ever need help, click the help button in the bottom-right corner. Happy building!",
    icon: CheckCircle,
  },
];

// Context for managing tour state
interface TourContextType {
  isOpen: boolean;
  openTour: () => void;
  closeTour: () => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  hasSeenTour: boolean;
  markTourAsSeen: () => void;
}

const TourContext = createContext<TourContextType | null>(null);

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasSeenTour, setHasSeenTour] = useState(true);

  useEffect(() => {
    const seen = localStorage.getItem('dataclaus_tour_seen');
    if (!seen) {
      setHasSeenTour(false);
      // Auto-open tour for new users after a short delay
      setTimeout(() => setIsOpen(true), 1000);
    }
  }, []);

  const openTour = () => {
    setCurrentStep(0);
    setIsOpen(true);
  };

  const closeTour = () => {
    setIsOpen(false);
  };

  const markTourAsSeen = () => {
    localStorage.setItem('dataclaus_tour_seen', 'true');
    setHasSeenTour(true);
  };

  return (
    <TourContext.Provider value={{ isOpen, openTour, closeTour, currentStep, setCurrentStep, hasSeenTour, markTourAsSeen }}>
      {children}
    </TourContext.Provider>
  );
}

// The Modal Component - Centered with fixed positioning
export function OnboardingModal() {
  const { isOpen, closeTour, currentStep, setCurrentStep, markTourAsSeen } = useTour();
  
  const step = tourSteps[currentStep];
  const Icon = step?.icon;
  const isLastStep = currentStep === tourSteps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (isLastStep) {
      markTourAsSeen();
      closeTour();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    markTourAsSeen();
    closeTour();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop - Full screen overlay */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        style={{ zIndex: 99999 }}
        onClick={handleSkip}
      />
      
      {/* Modal Container - truly centered */}
      <div 
        className="fixed inset-0 flex items-center justify-center p-4"
        style={{ zIndex: 100000 }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-2xl shadow-black/40 overflow-hidden">
            {/* Header with gradient */}
            <div className="relative h-32 bg-gradient-to-br from-primary via-blue-600 to-blue-800 flex items-center justify-center overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute inset-0 opacity-30">
                <div className="absolute top-4 left-8 w-20 h-20 bg-white/20 rounded-full blur-2xl"></div>
                <div className="absolute bottom-2 right-12 w-16 h-16 bg-white/10 rounded-full blur-xl"></div>
              </div>
              
              {/* Icon */}
              <motion.div
                key={currentStep}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', damping: 15 }}
                className="h-16 w-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center"
              >
                {Icon && <Icon size={32} className="text-white" weight="duotone" />}
              </motion.div>
              
              {/* Close button */}
              <button 
                onClick={handleSkip}
                className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors"
              >
                <X size={16} weight="bold" />
              </button>
              
              {/* Step indicator */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                {tourSteps.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 rounded-full transition-all ${i === currentStep ? 'w-6 bg-white' : 'w-1.5 bg-white/30'}`}
                  />
                ))}
              </div>
            </div>
            
            {/* Content */}
            <div className="p-8">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                <p className="text-slate-400 leading-relaxed">{step.description}</p>
              </motion.div>
            </div>
            
            {/* Footer */}
            <div className="px-8 pb-8 flex items-center justify-end">
              <div className="flex gap-3">
                {!isFirstStep && (
                  <Button 
                    variant="outline" 
                    onClick={handlePrev}
                    className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                  >
                    <ArrowLeft size={16} className="mr-2" />
                    Back
                  </Button>
                )}
                <Button 
                  onClick={handleNext}
                  className="bg-primary hover:bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                >
                  {isLastStep ? (
                    <Link href="/dashboard/my-apps" className="flex items-center">
                      <Sparkle size={16} className="mr-2" weight="fill" />
                      Get Started
                    </Link>
                  ) : (
                    <>
                      Next
                      <ArrowRight size={16} className="ml-2" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}

// Floating Help Button
export function HelpTriggerBadge() {
  const { openTour } = useTour();
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.button
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ delay: 0.5, type: 'spring' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={openTour}
      className="fixed bottom-6 right-6 h-12 w-12 rounded-full bg-primary hover:bg-blue-600 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center transition-all hover:scale-110"
      style={{ zIndex: 99998 }}
    >
      <Question size={20} weight="bold" />
      
      {/* Tooltip */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="absolute right-full mr-3 px-3 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg whitespace-nowrap shadow-lg"
          >
            Need help? Take a tour!
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
