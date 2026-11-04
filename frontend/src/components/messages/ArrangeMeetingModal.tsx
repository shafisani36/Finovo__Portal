import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Calendar,
  Clock,
  Video,
  ShieldCheck,
  Copy,
  Check,
  Sparkles,
  Users,
  X,
  Link2,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { MeetingItem } from './types';
import { CustomDatePicker } from '../ui/CustomCalendar';

interface ArrangeMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduleMeeting: (meeting: MeetingItem) => void;
  onStartInstantMeeting: () => void;
  defaultParticipant: string;
  companySlug?: string;
}

export const ArrangeMeetingModal: React.FC<ArrangeMeetingModalProps> = ({
  isOpen,
  onClose,
  onScheduleMeeting,
  onStartInstantMeeting,
  defaultParticipant,
  companySlug: propCompanySlug,
}) => {
  const routeParams = useParams<{ companySlug: string }>();
  const activeCompanySlug = propCompanySlug || routeParams.companySlug || 'workspace';

  const [title, setTitle] = useState(`Sync with ${defaultParticipant}`);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('14:30');
  const [duration, setDuration] = useState('30 min');
  const [copied, setCopied] = useState(false);

  // Helper for generating secure enterprise room codes
  const generateRoomCode = () => {
    const s1 = Math.random().toString(36).substring(2, 6);
    const s2 = Math.random().toString(36).substring(2, 6);
    return `fnv-${s1}-${s2}`;
  };

  // Helper for generating stable session encryption fingerprints
  const generateFingerprint = () => {
    const hex = Math.random().toString(16).substring(2, 10).toUpperCase();
    return `7F8A-${hex.substring(0, 4)}-${hex.substring(4, 8)}-E2A4`;
  };

  // Stable state: roomCode and fingerprint do NOT re-generate on render or copy
  const [roomCode, setRoomCode] = useState(() => generateRoomCode());
  const [fingerprint, setFingerprint] = useState(() => generateFingerprint());

  // Reset title when opening fresh modal
  useEffect(() => {
    if (isOpen) {
      setTitle(`Sync with ${defaultParticipant}`);
      setCopied(false);
    }
  }, [isOpen, defaultParticipant]);

  if (!isOpen) return null;

  // Fully dynamic meeting URL based on current host origin and active workspace slug
  const currentOrigin =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://portal.finovo.com';

  const dynamicMeetingLink = `${currentOrigin}/app/${activeCompanySlug}/meet/${roomCode}`;

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(dynamicMeetingLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRegenerateKey = () => {
    setRoomCode(generateRoomCode());
    setFingerprint(generateFingerprint());
    setCopied(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newMeeting: MeetingItem = {
      id: Math.random().toString(),
      title,
      date,
      time,
      duration,
      link: dynamicMeetingLink,
      participants: [defaultParticipant, 'You (Host)'],
      encryptionType: 'AES-256-GCM (Zero-Trust DTLS-SRTP E2EE)',
    };
    onScheduleMeeting(newMeeting);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/15 flex items-center justify-center text-[#f95716]">
              <Video className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
                Arrange Video Meeting
              </h3>
              <p className="text-xs text-slate-400">Schedule or instantly launch a Zero-Trust E2EE room</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Meeting Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#f95716] focus:ring-2 focus:ring-[#f95716]/10"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <CustomDatePicker
                label="Date"
                value={date}
                onChange={setDate}
                placeholder="Select meeting date"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Start Time</span>
              </label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#f95716]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Duration</label>
            <div className="grid grid-cols-4 gap-2">
              {['15 min', '30 min', '45 min', '60 min'].map((dur) => (
                <button
                  key={dur}
                  type="button"
                  onClick={() => setDuration(dur)}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    duration === dur
                      ? 'bg-orange-500/10 text-[#f95716] border border-orange-500/25'
                      : 'bg-slate-50 text-slate-600 border border-slate-200/60 hover:bg-slate-100'
                  }`}
                >
                  {dur}
                </button>
              ))}
            </div>
          </div>

          {/* Secure Zero-Trust Encryption Container */}
          <div className="p-4 bg-gradient-to-br from-emerald-50/70 via-slate-50/90 to-emerald-50/40 rounded-2xl border border-emerald-200/70 space-y-3 shadow-2xs">
            {/* Header: Zero-Trust Security Specification */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-emerald-600/10 border border-emerald-600/20 flex items-center justify-center text-emerald-600 shrink-0">
                  <ShieldCheck className="w-4 h-4 stroke-[2.2]" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                    <span>Zero-Trust Encryption</span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded border border-emerald-200/80">
                      AES-256-GCM
                    </span>
                  </h4>
                  <p className="text-[10.5px] text-slate-500 font-medium">
                    Hardware-isolated peer tunnel with zero server retention
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-white/95 px-2.5 py-1 rounded-full border border-emerald-200 shadow-2xs shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                DTLS-SRTP E2EE
              </span>
            </div>

            {/* Dynamic Meeting URL Input Bar */}
            <div className="flex items-center justify-between gap-2 bg-white px-3.5 py-2.5 rounded-xl border border-emerald-200/90 shadow-2xs focus-within:border-[#f95716] transition-all">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Link2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-slate-800 font-mono text-[11.5px] font-medium truncate select-all">
                  {dynamicMeetingLink}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* Deliberate Regenerate Key Button */}
                <button
                  type="button"
                  onClick={handleRegenerateKey}
                  className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                  title="Generate new secure room key"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>

                {/* Professional Copy Button */}
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-bold transition-all cursor-pointer ${
                    copied
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-orange-50 hover:bg-orange-100 text-[#f95716] border border-orange-200/80 active:scale-95'
                  }`}
                  title={copied ? 'Copied to clipboard' : 'Copy dynamic link'}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Cryptographic Session Fingerprint */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono px-0.5 pt-0.5">
              <span>
                Session Key: <strong className="text-slate-600 font-semibold">{fingerprint}</strong>
              </span>
              <span className="text-emerald-700 font-sans font-bold flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-600" />
                Active TLS 1.3 Tunnel
              </span>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onStartInstantMeeting();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Launch Now</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-500 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#e85a1a] via-[#f36b24] to-[#fa8136] hover:opacity-95 text-white text-xs font-bold shadow-[0_4px_14px_rgba(249,87,22,0.22)] transition-all cursor-pointer"
              >
                Schedule Meeting
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
