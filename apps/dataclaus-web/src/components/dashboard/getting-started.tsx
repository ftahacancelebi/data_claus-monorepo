'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { X, CheckCircle, ArrowRight, Code, Key, Rocket } from 'phosphor-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface GettingStartedProps {
  completedSteps: string[];
  onDismiss: () => void;
}

const steps = [
  {
    id: 'create-app',
    title: 'Create App',
    description: 'Register your first application',
    icon: Rocket,
    link: '/dashboard/my-apps',
    color: 'text-blue-500 bg-blue-50',
  },
  {
    id: 'generate-keys',
    title: 'Generate Keys',
    description: 'Get your API credentials',
    icon: Key,
    link: '/dashboard/api-keys',
    color: 'text-purple-500 bg-purple-50',
  },
  {
    id: 'integrate-sdk',
    title: 'Integrate SDK',
    description: 'Add DataClaus to your app',
    icon: Code,
    link: '/dashboard/docs',
    color: 'text-emerald-500 bg-emerald-50',
  },
];

export function GettingStarted({ completedSteps = [], onDismiss }: GettingStartedProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const progress = (completedSteps.length / steps.length) * 100;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className="glass-panel border-0 shadow-xl overflow-hidden relative">
         <div className="absolute top-0 left-0 w-full h-1 bg-slate-100">
            <motion.div 
                className="h-full bg-primary" 
                initial={{ width: 0 }} 
                animate={{ width: `${progress}%` }} 
                transition={{ duration: 1 }}
            />
         </div>

        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-lg font-bold text-slate-900">Getting Started</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                    {Math.round(progress)}% Complete
                </span>
              </div>
              <p className="text-slate-500 text-sm">
                Follow these steps to start monetizing your data.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="text-slate-400 hover:text-slate-600 hover:bg-slate-100/50"
            >
              <X size={18} />
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = completedSteps.includes(step.id);
              const isNext = !isCompleted && (index === 0 || completedSteps.includes(steps[index - 1].id));

              return (
                <Link href={step.link} key={step.id} className="block group">
                  <div className={cn(
                    "p-4 rounded-xl border transition-all duration-300 relative overflow-hidden h-full",
                    isCompleted ? "bg-emerald-50/50 border-emerald-100" : 
                    isNext ? "bg-white border-primary/30 shadow-md shadow-blue-500/5 ring-1 ring-primary/10" : 
                    "bg-slate-50/50 border-slate-100 opacity-70"
                  )}>
                    
                    {/* Status Icon */}
                    <div className="absolute top-4 right-4">
                         {isCompleted ? (
                             <CheckCircle size={20} className="text-emerald-500" weight="fill" />
                         ) : (
                             <div className={cn(
                                 "h-5 w-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold",
                                 isNext ? "border-primary text-primary" : "border-slate-300 text-slate-400"
                             )}>
                                 {index + 1}
                             </div>
                         )}
                    </div>

                    <div className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center mb-3 transition-colors",
                         isCompleted ? "bg-emerald-100 text-emerald-600" : step.color
                    )}>
                        <Icon size={20} weight={isCompleted ? "fill" : "duotone"} />
                    </div>

                    <h4 className={cn("font-bold mb-1", isCompleted ? "text-emerald-900" : "text-slate-900")}>
                        {step.title}
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed mb-3">
                        {step.description}
                    </p>

                    {!isCompleted && isNext && (
                         <div className="flex items-center text-xs font-bold text-primary mt-auto group-hover:translate-x-1 transition-transform">
                             Start Now <ArrowRight size={12} className="ml-1" />
                         </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
