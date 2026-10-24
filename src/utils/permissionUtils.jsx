import React from 'react';
import { Eye, ShieldAlert, Lock } from 'lucide-react';

export * from './permissionUtils.js';
import * as permCore from './permissionUtils.js';

/**
 * Reusable View-Only Alert Banner Component
 * Displays a styled warning when a user has view-only access to a module.
 */
export const ViewOnlyBanner = ({ 
  message = "You are currently in View-Only mode. Creating, submitting, uploading, editing, or deleting records is restricted.", 
  pageTitle,
  className = "" 
}) => {
  return (
    <div className={`mb-5 p-4 rounded-xl border border-amber-300/80 bg-gradient-to-r from-amber-50 via-amber-50/70 to-orange-50/60 shadow-xs flex items-center justify-between gap-3 text-amber-950 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-700 flex-shrink-0">
          <Eye className="w-5 h-5 text-amber-700 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-amber-800">
              View-Only Access
            </span>
            {pageTitle && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-200/60 text-amber-900">
                {pageTitle}
              </span>
            )}
          </div>
          <p className="text-xs text-amber-800/90 font-medium mt-0.5 leading-relaxed">
            {message}
          </p>
        </div>
      </div>
      <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100/70 border border-amber-300/60 text-[11px] font-semibold text-amber-800 flex-shrink-0">
        <Lock className="w-3.5 h-3.5" />
        <span>Read-Only</span>
      </div>
    </div>
  );
};

export default {
  ...permCore,
  ViewOnlyBanner
};
