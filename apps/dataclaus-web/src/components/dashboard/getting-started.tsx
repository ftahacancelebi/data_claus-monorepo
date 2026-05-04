'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Check, ArrowRight, Code, Key, Rocket, Terminal } from 'phosphor-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface GettingStartedProps {
  completedSteps: string[];
  onDismiss: () => void;
}

const steps = [
  {
    id: 'create-app',
    title: 'Create Your First App',
    description: 'Register an application to get your unique App ID',
    icon: Rocket,
    link: '/dashboard/my-apps',
    cta: 'Create App',
  },
  {
    id: 'generate-keys',
    title: 'Generate API Keys',
    description: 'Get your API Key and Secret for authentication',
    icon: Key,
    link: '/dashboard/api-keys',
    cta: 'Get Keys',
  },
  {
    id: 'integrate-sdk',
    title: 'Integrate the SDK',
    description: 'Add DataClaus SDK to your mobile or web app',
    icon: Code,
    link: '/dashboard/docs',
    cta: 'View Docs',
  },
];

export function GettingStarted({ completedSteps = [], onDismiss }: GettingStartedProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const completedCount = completedSteps.length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Card className="border border-slate-200 shadow-lg bg-white overflow-hidden">
        <CardContent className="p-0">
          <div className="grid lg:grid-cols-5">
            {/* Left Section - Welcome & Progress */}
            <div className="lg:col-span-2 bg-slate-900 text-white p-6 lg:p-8 relative overflow-hidden">
              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-800 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-slate-800 rounded-full translate-y-1/2 -translate-x-1/2" />
              
              {/* Dismiss Button - Mobile */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismiss}
                className="absolute top-4 right-4 lg:hidden h-8 w-8 p-0 text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X size={16} />
              </Button>

              <div className="relative">
                {/* Terminal Icon */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 text-slate-300 text-xs font-medium mb-4">
                  <Terminal size={14} />
                  Quick Start Guide
                </div>

                <h3 className="text-xl lg:text-2xl font-bold mb-2">
                  Get Started with DataClaus
                </h3>
                <p className="text-slate-400 text-sm mb-6">
                  Complete these 3 steps to start monetizing your user data with our privacy-first SDK.
                </p>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">Progress</span>
                    <span className="font-bold">{progressPercent}%</span>
                  </div>
                  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-white rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    {completedCount} of {steps.length} steps completed
                  </p>
                </div>
              </div>
            </div>

            {/* Right Section - Steps */}
            <div className="lg:col-span-3 p-6 lg:p-8">
              {/* Header with Dismiss */}
              <div className="hidden lg:flex items-center justify-between mb-6">
                <h4 className="text-sm font-semibold text-slate-900 uppercase tracking-wide">
                  Setup Checklist
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X size={16} />
                </Button>
              </div>

              {/* Steps List */}
              <div className="space-y-4">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  const isCompleted = completedSteps.includes(step.id);
                  const isNext = !isCompleted && (index === 0 || completedSteps.includes(steps[index - 1].id));
                  const isLocked = !isCompleted && !isNext;

                  return (
                    <Link 
                      href={isLocked ? '#' : step.link} 
                      key={step.id} 
                      className={cn("block group", isLocked && "cursor-not-allowed")}
                      onClick={(e) => isLocked && e.preventDefault()}
                    >
                      <div className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border transition-all duration-200",
                        isCompleted && "bg-slate-50 border-slate-200",
                        isNext && "bg-white border-slate-200 hover:border-slate-900 hover:shadow-md",
                        isLocked && "bg-slate-50/50 border-slate-100 opacity-50"
                      )}>
                        {/* Step Number / Status */}
                        <div className={cn(
                          "flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center font-bold text-sm transition-colors",
                          isCompleted && "bg-slate-900 text-white",
                          isNext && "bg-slate-900 text-white",
                          isLocked && "bg-slate-200 text-slate-400"
                        )}>
                          {isCompleted ? (
                            <Check size={18} weight="bold" />
                          ) : (
                            <span>{index + 1}</span>
                          )}
                        </div>

                        {/* Icon */}
                        <div className={cn(
                          "flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center",
                          isCompleted || isNext ? "bg-slate-100" : "bg-slate-100/50"
                        )}>
                          <Icon 
                            size={20} 
                            className={cn(
                              isCompleted ? "text-slate-500" :
                              isNext ? "text-slate-700" : "text-slate-400"
                            )}
                            weight={isCompleted ? "fill" : "regular"}
                          />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h5 className={cn(
                            "font-semibold text-sm truncate",
                            isCompleted ? "text-slate-600" :
                            isNext ? "text-slate-900" : "text-slate-400"
                          )}>
                            {step.title}
                          </h5>
                          <p className={cn(
                            "text-xs truncate mt-0.5",
                            isCompleted || isNext ? "text-slate-500" : "text-slate-400"
                          )}>
                            {step.description}
                          </p>
                        </div>

                        {/* Action */}
                        <div className="flex-shrink-0">
                          {isCompleted ? (
                            <span className="text-xs font-medium text-slate-500 px-3 py-1.5 bg-slate-100 rounded-lg">
                              Done
                            </span>
                          ) : isNext ? (
                            <span className="inline-flex items-center text-xs font-semibold text-slate-900 px-3 py-1.5 bg-slate-100 rounded-lg group-hover:bg-slate-900 group-hover:text-white transition-colors">
                              {step.cta}
                              <ArrowRight size={12} className="ml-1.5 group-hover:translate-x-0.5 transition-transform" />
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400 px-3 py-1.5">
                              Locked
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Bottom Hint */}
              <p className="text-xs text-slate-400 mt-4 text-center lg:text-left">
                Need help? Check our <Link href="/dashboard/docs" className="text-slate-600 hover:text-slate-900 underline underline-offset-2">documentation</Link> or contact support.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
