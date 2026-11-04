import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Video, Phone, PhoneOff, Volume2, ShieldCheck, Sparkles } from 'lucide-react';
import { socketService } from './socketService';

export interface IncomingCallSignal {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  receiverId?: string;
  receiverUserId?: string;
  isVideo: boolean;
  conversationId?: number;
  e2eeFingerprint?: string;
}

interface IncomingCallModalProps {
  call: IncomingCallSignal | null;
  onAccept: (call: IncomingCallSignal) => void;
  onDecline: (call: IncomingCallSignal) => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  call,
  onAccept,
  onDecline,
}) => {
  const [ringTime, setRingTime] = useState(0);

  useEffect(() => {
    if (!call) {
      setRingTime(0);
      return;
    }
    const timer = setInterval(() => {
      setRingTime((prev) => prev + 1);
    }, 1000);

    // Auto-decline after 30 seconds of no answer
    const timeout = setTimeout(() => {
      onDecline(call);
    }, 30000);

    // If caller cancels before recipient answers, immediately dismiss
    const unsubEnd = socketService.on('call_ended', (data) => {
      if (!data?.callId || data.callId === call.callId) {
        onDecline(call);
      }
    });

    return () => {
      clearInterval(timer);
      clearTimeout(timeout);
      unsubEnd();
    };
  }, [call, onDecline]);

  if (!call) return null;

  const callerInitials = call.callerAvatar || (call.callerName || 'U').substring(0, 2).toUpperCase();

  return createPortal(
    <div className="fixed inset-0 z-[999999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-orange-200/90 overflow-hidden text-center p-6 sm:p-7 space-y-6">
        {/* Glow Header */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-orange-600 uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
          <span>Incoming {call.isVideo ? 'Encrypted Video Call' : 'HD Voice Call'}</span>
        </div>

        {/* Pulsating Ringing Avatar */}
        <div className="relative inline-flex items-center justify-center my-2">
          {/* Animated acoustic waves */}
          <div
            className="absolute w-36 h-36 rounded-full bg-orange-500/15 animate-ping pointer-events-none"
            style={{ animationDuration: '2.5s' }}
          />
          <div className="absolute w-28 h-28 rounded-full bg-orange-500/20 animate-pulse pointer-events-none" />
          <div className="relative w-22 h-22 rounded-3xl bg-gradient-to-tr from-[#e85a1a] via-[#f36b24] to-[#fa8136] flex items-center justify-center text-white text-2xl font-black shadow-[0_8px_24px_rgba(249,87,22,0.3)] ring-4 ring-orange-500/25">
            {callerInitials}
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 ring-4 ring-white flex items-center justify-center shadow-xs">
            <Volume2 className="w-3.5 h-3.5 text-white animate-bounce" />
          </div>
        </div>

        {/* Caller Info */}
        <div className="space-y-1">
          <h3 className="text-lg font-black text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
            {call.callerName}
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Ringing ({ringTime}s) • Peer-to-Peer
          </p>
          <div className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full mt-1 font-semibold">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>End-to-End Encrypted</span>
          </div>
        </div>

        {/* Action Controls: Accept (Green) & Decline (Red) */}
        <div className="flex items-center justify-center gap-4 pt-2">
          {/* Decline Button */}
          <button
            type="button"
            onClick={() => onDecline(call)}
            className="flex-1 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-xs font-bold transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-2xs"
          >
            <PhoneOff className="w-4 h-4 text-rose-500" />
            <span>Decline</span>
          </button>

          {/* Accept / Join Button */}
          <button
            type="button"
            onClick={() => onAccept(call)}
            className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs font-bold transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-[0_4px_16px_rgba(16,185,129,0.3)]"
          >
            {call.isVideo ? (
              <Video className="w-4 h-4 stroke-[2.5]" />
            ) : (
              <Phone className="w-4 h-4 stroke-[2.5]" />
            )}
            <span>Accept Call</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

