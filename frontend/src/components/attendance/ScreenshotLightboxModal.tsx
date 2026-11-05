export const normalizeImageUrl = (url?: string): string => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:')) return url;
  if (url.includes('/storage/')) {
    return '/storage/' + url.split('/storage/')[1];
  }
  return url;
};

import React from 'react';
import { X, Camera, Download, ExternalLink, ShieldCheck } from 'lucide-react';
import type { ScreenshotItem } from '../../pages/AttendanceLeavePage';

interface ScreenshotLightboxModalProps {
  screenshot: ScreenshotItem | null;
  onClose: () => void;
}

export const ScreenshotLightboxModal: React.FC<ScreenshotLightboxModalProps> = ({
  screenshot,
  onClose,
}) => {
  if (!screenshot) return null;
  const imageUrl = normalizeImageUrl(screenshot.url);

  const formattedTime = screenshot.stored_at
    ? new Date(screenshot.stored_at).toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Live Remote Capture';

  return (
    <div className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-8 animate-in fade-in">
      <div className="w-full max-w-5xl bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 flex flex-col max-h-[95vh]">
        {/* Top Header Bar */}
        <div className="p-4 px-6 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-[#F95716] flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-sm text-slate-100">Live Employee Screen Capture</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Verified &amp; Saved</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {formattedTime} &bull; {screenshot.admin?.name ? `Captured by ${screenshot.admin.name}` : 'Captured by Administrator'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition"
              title="Open full size image in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open Tab</span>
            </a>
            <a
              href={imageUrl}
              download={`screenshot_${screenshot.id || Date.now()}.${imageUrl.includes('.png') ? 'png' : 'svg'}`}
              className="px-3 py-1.5 bg-[#F95716] hover:bg-[#e0480a] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
              title="Download screenshot"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Display Canvas */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-slate-950">
          <img
            src={imageUrl}
            alt="Employee Screen Capture"
            className="max-w-full max-h-[72vh] object-contain rounded-xl shadow-lg border border-slate-800/80"
          />
        </div>
      </div>
    </div>
  );
};
