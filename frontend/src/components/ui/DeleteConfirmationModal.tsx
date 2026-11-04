import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, AlertTriangle, Info, X, Loader2, CheckCircle2 } from 'lucide-react';

export interface DeleteConfirmationModalProps {
  isOpen: boolean;
  title?: string;
  message?: React.ReactNode;
  itemName?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  isDeleting?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  singleActionOnly?: boolean; // When used as an alert dialog replacement
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  title = 'Confirm Deletion',
  message = 'Are you sure you want to delete this item? This action cannot be undone.',
  itemName,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  variant = 'danger',
  isDeleting = false,
  onConfirm,
  onCancel,
  singleActionOnly = false,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onCancel]);

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <Trash2 className="w-6 h-6 stroke-[2.2]" />,
          iconBg: 'bg-rose-50 border-rose-100 text-rose-600 ring-rose-500/10',
          confirmBtn:
            'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-600 hover:to-rose-700 shadow-rose-500/25 text-white',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 stroke-[2.2]" />,
          iconBg: 'bg-amber-50 border-amber-100 text-amber-600 ring-amber-500/10',
          confirmBtn:
            'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-amber-500/25 text-white',
        };
      case 'success':
        return {
          icon: <CheckCircle2 className="w-6 h-6 stroke-[2.2]" />,
          iconBg: 'bg-emerald-50 border-emerald-100 text-emerald-600 ring-emerald-500/10',
          confirmBtn:
            'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-emerald-500/25 text-white',
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-6 h-6 stroke-[2.2]" />,
          iconBg: 'bg-orange-50 border-orange-100 text-[#f95716] ring-orange-500/10',
          confirmBtn:
            'bg-gradient-to-r from-[#e85a1a] via-[#f36b24] to-[#fa8136] hover:opacity-95 shadow-orange-500/25 text-white',
        };
    }
  };

  const currentStyles = getVariantStyles();

  const modalContent = (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      {/* Backdrop Dismiss */}
      <div
        className="absolute inset-0"
        onClick={() => {
          if (!isDeleting) onCancel();
        }}
      />

      {/* Modal Dialog Card */}
      <div
        className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Close Icon */}
        <button
          type="button"
          disabled={isDeleting}
          onClick={onCancel}
          className="absolute right-4 top-4 w-7 h-7 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30"
          title="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Central Icon Header with glowing halo */}
        <div className="text-center pt-2">
          <div
            className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center border ring-4 mb-3.5 transition-all ${currentStyles.iconBg}`}
          >
            {currentStyles.icon}
          </div>

          <h3 className="text-base sm:text-lg font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
            {title}
          </h3>

          <div className="text-xs sm:text-[13px] text-slate-500 mt-2 leading-relaxed font-normal">
            {typeof message === 'string' ? <p>{message}</p> : message}
          </div>
        </div>

        {/* Highlighted Item Badge (Optional) */}
        {itemName && (
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Item:</span>
            <span className="text-xs font-bold text-slate-900 font-mono truncate max-w-[280px]">
              {itemName}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          {!singleActionOnly && (
            <button
              type="button"
              disabled={isDeleting}
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50 flex items-center gap-2 ${currentStyles.confirmBtn}`}
          >
            {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isDeleting ? 'Processing...' : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
