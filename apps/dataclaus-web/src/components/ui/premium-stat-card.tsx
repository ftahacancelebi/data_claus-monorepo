'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { TrendUp, TrendDown } from 'phosphor-react';

interface PremiumStatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number; // e.g., 20 for +20%, -15 for -15%
  watermark?: React.ReactNode;
}

export function PremiumStatCard({
  title,
  value,
  icon,
  trend,
  watermark,
}: PremiumStatCardProps) {
  const isPositive = trend && trend > 0;
  const isNegative = trend && trend < 0;

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="relative overflow-hidden bg-white rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col justify-between min-h-[160px] group"
    >
      {/* Background Watermark Asset */}
      <div className="absolute -bottom-10 -right-4 w-48 h-48 text-slate-900 opacity-[0.02] pointer-events-none group-hover:opacity-[0.04] group-hover:rotate-12 transition-all duration-700 ease-out z-0">
        {watermark || (
          <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
            <circle cx="50" cy="50" r="40" strokeDasharray="4 8" />
            <circle cx="50" cy="50" r="30" />
            <path d="M 50 10 L 50 90 M 10 50 L 90 50" strokeDasharray="2 4" />
            <rect x="35" y="35" width="30" height="30" rx="4" />
          </svg>
        )}
      </div>

      <div className="relative z-10 flex items-start justify-between mb-4">
        {/* Main Icon with subtle cyan/primary highlight effect */}
        <div className="relative">
          <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 opacity-50 blur-[2px]"></div>
          <div className="text-slate-700">
            {icon}
          </div>
        </div>

        {/* Trend Pill */}
        {trend !== undefined && (
          <div
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold ${
              isPositive
                ? 'bg-indigo-50 text-indigo-700'
                : isNegative
                ? 'bg-rose-50 text-rose-700'
                : 'bg-slate-50 text-slate-600'
            }`}
          >
            {Math.abs(trend)}%
            {isPositive && <TrendUp size={12} weight="bold" />}
            {isNegative && <TrendDown size={12} weight="bold" />}
          </div>
        )}
      </div>

      <div className="relative z-10 mt-auto">
        <p className="text-[13px] font-medium text-slate-500 mb-1">
          {title}
        </p>
        <p className="text-3xl font-bold text-slate-900 tracking-tight">
          {value}
        </p>
      </div>
    </motion.div>
  );
}
