'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { 
  CaretDown, 
  Question, 
  Code, 
  CurrencyDollar, 
  ShieldCheck, 
  Lifebuoy,
  Lightning,
  Database,
  Rocket
} from 'phosphor-react';

interface FAQItem {
  question: string;
  answer: string;
  icon: React.ElementType;
  category: 'general' | 'integration' | 'billing' | 'security';
}

const faqItems: FAQItem[] = [
  {
    question: "What is DataClaus?",
    answer: "DataClaus is a data infrastructure platform that enables developers to monetize user data while ensuring privacy compliance. We provide SDKs for React Native, Node.js, and Web that make it easy to collect, verify, and monetize structured training data.",
    icon: Rocket,
    category: 'general'
  },
  {
    question: "How do I get started with integration?",
    answer: "Getting started is simple: 1) Create an account and register your app in the Applications section. 2) Generate API keys from the API Keys page. 3) Install our SDK using npm or yarn. 4) Follow our Quick Start guide in the SDK Documentation. Most developers are up and running within 30 minutes.",
    icon: Code,
    category: 'integration'
  },
  {
    question: "What platforms do you support?",
    answer: "We currently support React Native (iOS & Android), Node.js for backend applications, and a Web SDK for browser-based apps. Our SDKs are designed to be lightweight and have minimal impact on your app's performance.",
    icon: Lightning,
    category: 'integration'
  },
  {
    question: "How does the reCAPTCHA verification work?",
    answer: "We use Google reCAPTCHA v3 to verify that data comes from real human users, not bots. The verification happens seamlessly in the background without interrupting user experience. Our SDK handles the token generation, and your backend validates it using our API.",
    icon: ShieldCheck,
    category: 'security'
  },
  {
    question: "How is my data protected?",
    answer: "Security is our top priority. All data is encrypted in transit using TLS 1.3 and at rest using AES-256. We are GDPR and CCPA compliant, and we never share raw user data. Our infrastructure is hosted on enterprise-grade cloud providers with SOC 2 Type II certification.",
    icon: ShieldCheck,
    category: 'security'
  },
  {
    question: "How do I earn revenue?",
    answer: "Developers earn revenue based on the volume and quality of verified data collected through their apps. Higher quality data (verified human users with complete metadata) earns more. Revenue is calculated daily and can be withdrawn once you reach the minimum threshold of $50.",
    icon: CurrencyDollar,
    category: 'billing'
  },
  {
    question: "What payment methods do you support?",
    answer: "We support bank transfers (ACH/SEPA), PayPal, and cryptocurrency (USDC). Payments are processed within 3-5 business days after withdrawal request. There are no fees for withdrawals over $100.",
    icon: CurrencyDollar,
    category: 'billing'
  },
  {
    question: "What is the data quality score?",
    answer: "The quality score (0-100%) measures how valuable the collected data is for training AI models. Factors include: verification status, completeness of metadata, user engagement patterns, and data consistency. Higher scores result in higher revenue per event.",
    icon: Database,
    category: 'general'
  },
  {
    question: "Do you have rate limits?",
    answer: "Yes, our standard plan allows up to 1,000 API requests per minute and 100,000 events per day. For higher limits, contact our enterprise team for a custom plan tailored to your needs.",
    icon: Lightning,
    category: 'integration'
  },
  {
    question: "How do I get support?",
    answer: "We offer multiple support channels: 1) In-app help center with searchable documentation. 2) Email support at support@dataclaus.io (response within 24 hours). 3) Priority Slack channel for enterprise customers. 4) Community Discord for general discussions.",
    icon: Lifebuoy,
    category: 'general'
  },
];

const categories = [
  { id: 'all', label: 'All Questions', icon: Question },
  { id: 'general', label: 'General', icon: Rocket },
  { id: 'integration', label: 'Integration', icon: Code },
  { id: 'billing', label: 'Billing', icon: CurrencyDollar },
  { id: 'security', label: 'Security', icon: ShieldCheck },
];

export default function FAQPage() {
  const { user } = useAuth();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  if (!user) return null;

  const filteredFAQs = activeCategory === 'all' 
    ? faqItems 
    : faqItems.filter(item => item.category === activeCategory);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary/10 mb-6">
          <Question size={32} className="text-primary" weight="duotone" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">
          Frequently Asked Questions
        </h1>
        <p className="text-slate-500 max-w-lg mx-auto">
          Find answers to common questions about DataClaus, integration, billing, and more.
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap justify-center gap-2">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeCategory === cat.id
                  ? 'bg-primary text-white shadow-md shadow-blue-600/20'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Icon size={16} weight={activeCategory === cat.id ? 'fill' : 'duotone'} />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* FAQ Accordion */}
      <div className="space-y-3">
        {filteredFAQs.map((item, index) => {
          const Icon = item.icon;
          const isOpen = openIndex === index;
          
          return (
            <motion.div
              key={item.question}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className={`glass-panel border-0 shadow-lg overflow-hidden transition-all ${isOpen ? 'ring-2 ring-primary/20' : ''}`}>
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full p-6 flex items-center gap-4 text-left"
                >
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                    isOpen ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <Icon size={20} weight="duotone" />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className={`font-semibold transition-colors ${isOpen ? 'text-primary' : 'text-slate-900'}`}>
                      {item.question}
                    </h3>
                  </div>
                  
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex-shrink-0 ${isOpen ? 'text-primary' : 'text-slate-400'}`}
                  >
                    <CaretDown size={20} weight="bold" />
                  </motion.div>
                </button>
                
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <CardContent className="pt-0 px-6 pb-6">
                        <div className="pl-14">
                          <p className="text-slate-600 leading-relaxed">
                            {item.answer}
                          </p>
                        </div>
                      </CardContent>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Contact CTA */}
      <Card className="bg-gradient-to-r from-primary via-blue-600 to-blue-700 border-0 overflow-hidden">
        <CardContent className="p-8 relative">
          {/* Decorative */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-[-50%] right-[-20%] w-[60%] h-[200%] bg-white/5 rotate-12"></div>
          </div>
          
          <div className="relative text-center">
            <Lifebuoy size={40} className="text-white/80 mx-auto mb-4" weight="duotone" />
            <h3 className="text-xl font-bold text-white mb-2">Still have questions?</h3>
            <p className="text-blue-100 mb-6 max-w-md mx-auto">
              Our support team is here to help. Reach out and we'll get back to you within 24 hours.
            </p>
            <a 
              href="mailto:support@dataclaus.io"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary font-semibold rounded-xl hover:bg-blue-50 transition-colors shadow-lg"
            >
              Contact Support
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
