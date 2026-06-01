'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Star, GlobeHemisphereWest } from 'phosphor-react';

interface PremiumAppCardProps {
  appName?: string;
  category?: string;
  stat1Label?: string;
  stat1Value?: string | number;
  stat2Label?: string;
  stat2Value?: string | number;
  stat3Label?: string;
  stat3Value?: string | number;
  badgeText?: string;
  badgeActive?: boolean;
  icon?: React.ReactNode;
  actionHref?: string;
  onActionClick?: () => void;
}

export function PremiumAppCard({
  appName = 'Google Earth',
  category = 'Location',
  stat1Label = 'Rating',
  stat1Value = 4.5,
  stat2Label = 'Size',
  stat2Value = '23.5 MB',
  stat3Label = 'Downloads',
  stat3Value = '5M',
  badgeText = 'Free',
  badgeActive = true,
  icon = <GlobeHemisphereWest weight="duotone" className="w-5 h-5 text-blue-500" />,
  actionHref,
  onActionClick,
}: PremiumAppCardProps) {
  const cardContent = (
    <div className="relative text-left w-full max-w-[340px] min-h-[360px] h-full bg-white rounded-[2.5rem] px-8 pt-8 pb-12 overflow-hidden group shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] border border-slate-100 flex flex-col justify-between hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] hover:border-slate-200 transition-all cursor-pointer">
      {/* Decorative Background Shapes */}
      <div className="absolute -bottom-12 -right-12 w-[120%] h-[120%] pointer-events-none z-0 opacity-60 transition-all duration-700 ease-out group-hover:scale-105 group-hover:opacity-90">
        <svg viewBox="0 0 400 400" className="absolute bottom-0 right-0 w-full h-[220px]" preserveAspectRatio="none">
          <path
            fill="#FBBF24"
            d="M 300 200 C 250 150 150 200 100 250 C 50 300 -20 280 0 400 L 400 400 Z"
            className="opacity-80"
          />
          <path
            fill="#3B82F6"
            d="M 150 400 C 150 300 250 250 300 200 C 350 150 400 180 400 400 Z"
            className="opacity-90 mix-blend-multiply"
          />
          <path
            fill="#2563EB"
            d="M -50 400 C -20 320 80 280 150 300 C 220 320 280 380 300 400 Z"
            className="opacity-90 mix-blend-multiply"
          />
          <path
            fill="#60A5FA"
            d="M 100 400 C 150 350 200 300 280 280 C 350 260 400 300 400 400 Z"
            className="opacity-50"
          />
        </svg>
      </div>

      {/* Top Header */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0 pr-2">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 border border-slate-100 shadow-sm shrink-0">
            {icon}
          </div>
          <span className="text-sm font-medium text-slate-700 tracking-tight leading-tight pt-1.5 line-clamp-2">
            {category}
          </span>
        </div>
        <div className={`shrink-0 px-3 py-1.5 mt-0.5 text-xs font-bold rounded-full tracking-wide ${badgeActive ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
          {badgeText}
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 mt-6 flex-1 flex flex-col">
        <h2 className="text-[28px] tracking-tight leading-[1.15] font-extrabold text-slate-900 mb-6 line-clamp-3">
          {appName}
        </h2>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 mt-auto">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1 truncate">{stat1Label}</span>
            <div className="flex items-center gap-1">
              <span className="text-sm font-bold text-slate-900">{stat1Value}</span>
            </div>
          </div>
          
          <div className="flex flex-col border-l border-slate-200 pl-4">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1 truncate">{stat2Label}</span>
            <span className="text-sm font-bold text-slate-900">{stat2Value}</span>
          </div>

          <div className="flex flex-col border-l border-slate-200 pl-4">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 mb-1 truncate">{stat3Label}</span>
            <span className="text-sm font-bold text-slate-900 truncate">{stat3Value}</span>
          </div>
        </div>
      </div>

      {/* Bottom Action */}
      <div className="relative z-10 mt-6 flex items-center justify-start">
        <div className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 group-hover:text-blue-800 transition-colors bg-white/70 backdrop-blur-md px-4 py-2 rounded-xl shadow-sm border border-white/40 group-hover:bg-white/90">
          View Details <ArrowRight weight="bold" className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
      className="h-full flex justify-center"
    >
      {actionHref ? (
        <a href={actionHref} className="block h-full outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-[2.5rem]">
          {cardContent}
        </a>
      ) : (
        <button onClick={onActionClick} className="block h-full outline-none text-left focus-visible:ring-2 focus-visible:ring-blue-500 rounded-[2.5rem]">
          {cardContent}
        </button>
      )}
    </motion.div>
  );
}
