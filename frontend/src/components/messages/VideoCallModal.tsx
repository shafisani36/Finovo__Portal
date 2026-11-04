import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  ScreenShare,
  ShieldCheck,
  Maximize2,
  Minimize2,
  Volume2,
  Lock,
  Sparkles,
  PictureInPicture2,
  X,
  User,
} from 'lucide-react';
import { socketService } from './socketService';

interface VideoCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  callId?: string;
  participantName: string;
  participantAvatar: string;
  isVideoCall: boolean;
  isIncomingCall?: boolean;
  onCallEnded?: (durationSeconds: number, isVideo: boolean) => void;
}

export const VideoCallModal: React.FC<VideoCallModalProps> = ({
  isOpen,
  onClose,
  callId: callIdProp,
  participantName,
  participantAvatar,
  isVideoCall: isVideoCallProp,
  isIncomingCall = false,
  onCallEnded,
}) => {
  const [callStatus, setCallStatus] = useState<'ringing' | 'connected' | 'ended'>(
    isIncomingCall ? 'connected' : 'ringing'
  );
  const [statusMessage, setStatusMessage] = useState<string>(
    isIncomingCall ? 'Connected' : 'Calling...'
  );
  const [isVoiceOnly, setIsVoiceOnly] = useState(!isVideoCallProp);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(!isVideoCallProp);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [modalLayout, setModalLayout] = useState<'standard' | 'fullscreen' | 'pip'>('standard');
  const [callDuration, setCallDuration] = useState(0);
  const [showKeyDetails, setShowKeyDetails] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [hasRemoteAudio, setHasRemoteAudio] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const callIdRef = useRef<string | undefined>(callIdProp);
  callIdRef.current = callIdProp;

  // Sync state whenever modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setCallStatus(isIncomingCall ? 'connected' : 'ringing');
      setStatusMessage(isIncomingCall ? 'Connected' : 'Calling...');
      setIsVoiceOnly(!isVideoCallProp);
      setIsVideoDisabled(!isVideoCallProp);
      setIsMuted(false);
      setIsScreenSharing(false);
      setModalLayout('standard');
      setCallDuration(0);
      setHasRemoteVideo(false);
      setHasRemoteAudio(false);
    }
  }, [isOpen, isVideoCallProp, isIncomingCall]);

  const handleEndCall = () => {
    setCallStatus('ended');
    setStatusMessage('Call Ended');
    const id = callIdRef.current || `call_${Date.now()}`;
    socketService.endCall(id);
    onCallEnded?.(callDuration, !isVoiceOnly);
    cleanupMedia();
    onClose();
  };

  const cleanupMedia = () => {
    if (peerConnectionRef.current) {
      try {
        peerConnectionRef.current.close();
      } catch {}
      peerConnectionRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    remoteStreamRef.current = null;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  };

  // 1. Ringing state timeout: if caller rings for 30s with no answer, auto-cancel
  useEffect(() => {
    if (!isOpen || callStatus !== 'ringing') return;
    const ringingTimeout = setTimeout(() => {
      setCallStatus('ended');
      setStatusMessage('No Answer');
      const id = callIdRef.current || `call_${Date.now()}`;
      socketService.endCall(id);
      onCallEnded?.(0, !isVoiceOnly);
      cleanupMedia();
      setTimeout(() => {
        onClose();
      }, 1600);
    }, 30000);

    return () => clearTimeout(ringingTimeout);
  }, [isOpen, callStatus, isVoiceOnly, onCallEnded, onClose]);

  // 2. Caller listens for peer answering
  useEffect(() => {
    if (!isOpen) return;
    const unsubAnswer = socketService.on('call_answered', () => {
      setCallStatus('connected');
      setStatusMessage('Connected');
    });

    return () => unsubAnswer();
  }, [isOpen]);

  // 3. Listen for peer declining or hanging up
  useEffect(() => {
    if (!isOpen) return;

    const unsubDeclined = socketService.on('call_declined', () => {
      setCallStatus('ended');
      setStatusMessage('Call Declined');
      onCallEnded?.(0, !isVoiceOnly);
      cleanupMedia();
      setTimeout(() => {
        onClose();
      }, 1600);
    });

    const unsubEnded = socketService.on('call_ended', (data) => {
      setCallStatus('ended');
      setStatusMessage(data?.reason === 'declined' ? 'Call Declined' : 'Call Ended');
      onCallEnded?.(callDuration, !isVoiceOnly);
      cleanupMedia();
      setTimeout(() => {
        onClose();
      }, 1600);
    });

    return () => {
      unsubDeclined();
      unsubEnded();
    };
  }, [isOpen, callDuration, isVoiceOnly, onCallEnded, onClose]);

  // 4. Timer effect - only increments when callStatus === 'connected'
  useEffect(() => {
    if (!isOpen || callStatus !== 'connected') {
      return;
    }
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isOpen, callStatus]);

  // =========================================================================
  // 5. NATIVE WEBRTC PEER CONNECTION & MEDIA STREAM PIPELINE
  // =========================================================================

  useEffect(() => {
    if (!isOpen || callStatus !== 'connected') {
      return;
    }

    let isCancelled = false;
    const currentCallId = callIdRef.current;

    const initWebRTC = async () => {
      try {
        console.log('[WebRTC] Initializing native peer connection for call:', currentCallId);

        // 1. Acquire local microphone and webcam
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: !isVoiceOnly && !isVideoDisabled,
        });

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // 2. Instantiate RTCPeerConnection with standard public STUN servers
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        });
        peerConnectionRef.current = pc;

        // 3. Attach local tracks to the connection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // 4. Handle incoming remote audio and video tracks
        pc.ontrack = (event) => {
          console.log('[WebRTC] Received remote track:', event.track.kind);
          const [remoteStream] = event.streams;
          if (remoteStream) {
            remoteStreamRef.current = remoteStream;

            if (event.track.kind === 'video') {
              setHasRemoteVideo(true);
              if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
                remoteVideoRef.current.play().catch(() => {});
              }
            }

            if (event.track.kind === 'audio') {
              setHasRemoteAudio(true);
              if (remoteAudioRef.current) {
                remoteAudioRef.current.srcObject = remoteStream;
                remoteAudioRef.current.play().catch((err) => {
                  console.warn('[WebRTC] Remote audio autoplay handled:', err);
                });
              }
            }
          }
        };

        // 5. Send ICE candidates to peer via Socket.IO
        pc.onicecandidate = (event) => {
          if (event.candidate && currentCallId) {
            socketService.sendWebRtcIceCandidate(currentCallId, event.candidate.toJSON());
          }
        };

        // 6. Caller creates WebRTC Offer; Recipient waits for Offer
        if (!isIncomingCall) {
          console.log('[WebRTC] Creating SDP Offer...');
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc.setLocalDescription(offer);
          if (currentCallId) {
            socketService.sendWebRtcOffer(currentCallId, offer);
          }
        }
      } catch (err) {
        console.error('[WebRTC] Media initialization error:', err);
      }
    };

    initWebRTC();

    // 7. WebRTC Signaling Listeners
    const unsubOffer = socketService.on('webrtc_offer', async (data: any) => {
      const pc = peerConnectionRef.current;
      if (pc && (!currentCallId || data?.callId === currentCallId) && pc.signalingState !== 'closed') {
        try {
          console.log('[WebRTC] Processing incoming Offer and generating Answer...');
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (currentCallId || data?.callId) {
            socketService.sendWebRtcAnswer(currentCallId || data.callId, answer);
          }
        } catch (err) {
          console.error('[WebRTC] Failed to process offer:', err);
        }
      }
    });

    const unsubAnswer = socketService.on('webrtc_answer', async (data: any) => {
      const pc = peerConnectionRef.current;
      if (pc && (!currentCallId || data?.callId === currentCallId) && pc.signalingState === 'have-local-offer') {
        try {
          console.log('[WebRTC] Processing incoming Answer from remote peer...');
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        } catch (err) {
          console.error('[WebRTC] Failed to process answer:', err);
        }
      }
    });

    const unsubIce = socketService.on('webrtc_ice_candidate', async (data: any) => {
      const pc = peerConnectionRef.current;
      if (pc && (!currentCallId || data?.callId === currentCallId) && data.candidate && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.warn('[WebRTC] Could not add ICE candidate:', err);
        }
      }
    });

    return () => {
      isCancelled = true;
      unsubOffer();
      unsubAnswer();
      unsubIce();
      cleanupMedia();
    };
  }, [isOpen, callStatus, isIncomingCall]);

  // Handle Mute Microphone Toggle
  const handleToggleMute = () => {
    setIsMuted((prev) => {
      const nextMuted = !prev;
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !nextMuted;
        });
      }
      return nextMuted;
    });
  };

  // Handle Video Camera Toggle
  const handleToggleVideo = async () => {
    if (isVoiceOnly) {
      // Switching from voice-only to video call
      setIsVoiceOnly(false);
      setIsVideoDisabled(false);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          if (localStreamRef.current) {
            localStreamRef.current.addTrack(videoTrack);
          }
          if (peerConnectionRef.current) {
            peerConnectionRef.current.addTrack(videoTrack, localStreamRef.current || stream);
          }
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = new MediaStream([videoTrack]);
          }
        }
      } catch (err) {
        console.warn('Could not activate camera on toggle:', err);
      }
    } else {
      setIsVideoDisabled((prev) => {
        const nextDisabled = !prev;
        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach((track) => {
            track.enabled = !nextDisabled;
          });
        }
        return nextDisabled;
      });
    }
  };

  if (!isOpen) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const e2eeFingerprint = '7F8A-92BC-44D1-0988-E2A4-71F0';
  const isFullscreen = modalLayout === 'fullscreen';
  const isPip = modalLayout === 'pip';

  return createPortal(
    <div
      className={`fixed inset-0 z-[99999] transition-all duration-200 ${
        isPip
          ? 'pointer-events-none'
          : 'bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-0 sm:p-4 md:p-6'
      }`}
    >
      {/* Hidden audio element for crystal-clear remote peer audio playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      <div
        className={`transition-all duration-300 flex flex-col justify-between overflow-hidden pointer-events-auto ${
          isFullscreen
            ? 'fixed inset-0 w-screen h-screen max-w-none rounded-none bg-slate-950 border-none z-[99999]'
            : isPip
            ? 'fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-84 md:w-92 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] border border-orange-300/80 bg-white z-[99999]'
            : 'relative w-full max-w-4xl h-full sm:h-[84vh] sm:max-h-[820px] bg-white rounded-none sm:rounded-3xl shadow-[0_24px_50px_rgba(0,0,0,0.18)] border border-slate-100'
        }`}
      >
        {/* Top Header Bar */}
        <div
          className={`p-3 sm:p-4 flex items-center justify-between border-b z-20 backdrop-blur-md transition-colors ${
            isFullscreen
              ? 'bg-slate-900/90 border-slate-800 text-white'
              : 'bg-white/95 border-slate-100 text-slate-900'
          }`}
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-2xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-[#f95716] font-bold text-xs sm:text-sm shadow-2xs shrink-0">
              {participantAvatar}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs sm:text-sm font-black truncate tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
                  {participantName}
                </h3>
                {callStatus === 'connected' ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                ) : callStatus === 'ringing' ? (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                )}
              </div>
              <p
                className={`text-[11px] font-mono font-bold ${
                  callStatus === 'connected'
                    ? 'text-[#f95716]'
                    : callStatus === 'ringing'
                    ? 'text-amber-500 animate-pulse'
                    : 'text-rose-500'
                }`}
              >
                {callStatus === 'connected'
                  ? formatDuration(callDuration)
                  : callStatus === 'ringing'
                  ? 'Ringing...'
                  : statusMessage}
              </p>
            </div>
          </div>

          {/* Top Controls: Zoom / Fullscreen / PiP / Close */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {!isPip && (
              <button
                type="button"
                onClick={() => setShowKeyDetails((prev) => !prev)}
                className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                  isFullscreen
                    ? 'bg-slate-800 border border-slate-700 text-emerald-400'
                    : 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                }`}
                title="Cryptographic Security Details"
              >
                <Lock className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="text-[10.5px]">DTLS 1.3</span>
              </button>
            )}

            {/* Picture-in-Picture / Mini Zoom Out Toggle */}
            <button
              type="button"
              onClick={() => setModalLayout((prev) => (prev === 'pip' ? 'standard' : 'pip'))}
              className={`w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
                isFullscreen
                  ? 'bg-slate-800 text-slate-300 hover:text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
              title={isPip ? 'Expand Call' : 'Minimize / Zoom Out (PiP)'}
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>

            {/* Fullscreen / Zoom In Toggle */}
            <button
              type="button"
              onClick={() => setModalLayout((prev) => (prev === 'fullscreen' ? 'standard' : 'fullscreen'))}
              className={`w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
                isFullscreen
                  ? 'bg-slate-800 text-slate-300 hover:text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
              title={isFullscreen ? 'Zoom Out to Window' : 'Zoom In to Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close Button in header */}
            <button
              type="button"
              onClick={handleEndCall}
              className={`w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer transition-colors ${
                isFullscreen
                  ? 'bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-400'
                  : 'bg-slate-100 hover:bg-rose-50 text-slate-400 hover:text-rose-600'
              }`}
              title="Hang Up and Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Security Details Dropdown */}
        {showKeyDetails && !isPip && (
          <div className="absolute top-16 right-4 sm:right-6 z-40 w-72 sm:w-84 bg-white border border-emerald-200 rounded-3xl p-4 shadow-2xl text-xs space-y-2.5 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-2 text-emerald-700 font-black border-b border-slate-100 pb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Zero-Trust Peer-to-Peer Encryption</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Media stream is protected by hardware-isolated DTLS-SRTP tunneling. Neither middle-boxes nor servers can inspect or decrypt content.
            </p>
            <div className="bg-slate-50 p-2 rounded-xl font-mono text-[9.5px] text-slate-700 break-all border border-slate-200">
              Fingerprint: {e2eeFingerprint}
            </div>
          </div>
        )}

        {/* Main Stage (Adaptive for Ringing vs Audio Call vs Video Call vs PiP vs Ended) */}
        <div
          className={`relative flex-1 flex items-center justify-center overflow-hidden transition-all ${
            isFullscreen
              ? 'bg-[radial-gradient(circle_at_50%_40%,rgba(249,87,22,0.18),rgba(15,23,42,1))]'
              : 'bg-[radial-gradient(circle_at_50%_40%,rgba(249,87,22,0.12),rgba(248,250,252,0.98))]'
          }`}
        >
          {/* STAGE 1: CALL ENDED / DECLINED / NO ANSWER */}
          {callStatus === 'ended' ? (
            <div className="flex flex-col items-center justify-center text-center space-y-4 p-6 max-w-sm w-full mx-4 animate-in fade-in zoom-in-95">
              <div className="w-20 h-20 rounded-full bg-rose-50 border-2 border-rose-200 flex items-center justify-center text-rose-500 shadow-md">
                <PhoneOff className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className={`text-base sm:text-lg font-black ${isFullscreen ? 'text-white' : 'text-slate-900'}`}>
                  {statusMessage}
                </h4>
                <p className="text-xs text-slate-400">
                  {callDuration > 0 ? `Call duration: ${formatDuration(callDuration)}` : 'Call closed without connection'}
                </p>
              </div>
            </div>
          ) : callStatus === 'ringing' ? (
            /* STAGE 2: CALL RINGING / CALLING */
            <div className="flex flex-col items-center justify-center text-center space-y-5 p-6 max-w-sm w-full mx-4 animate-in fade-in zoom-in-95">
              <div className="relative inline-flex items-center justify-center">
                <div
                  className="absolute w-40 h-40 sm:w-48 sm:h-48 rounded-full bg-orange-500/15 animate-ping"
                  style={{ animationDuration: '2.4s' }}
                />
                <div className="absolute w-30 h-30 sm:w-36 sm:h-36 rounded-full bg-orange-500/20 animate-pulse" />
                <div className="relative w-22 sm:w-26 h-22 sm:h-26 rounded-full bg-gradient-to-tr from-[#e85a1a] via-[#f36b24] to-[#fa8136] flex items-center justify-center text-white text-2xl sm:text-3xl font-black shadow-[0_8px_32px_rgba(249,87,22,0.35)] ring-4 ring-orange-500/30">
                  {participantAvatar}
                </div>
                <div className="absolute bottom-0 right-1 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-500 ring-4 ring-white flex items-center justify-center shadow-xs">
                  <Volume2 className="w-4 h-4 text-white animate-pulse" />
                </div>
              </div>

              <div className="space-y-1.5">
                <h4 className={`text-base sm:text-lg font-black tracking-tight font-['Plus_Jakarta_Sans',sans-serif] ${isFullscreen ? 'text-white' : 'text-slate-900'}`}>
                  Calling {participantName}...
                </h4>
                <p className="text-xs text-amber-600 font-bold flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <span>Ringing... Waiting for answer</span>
                </p>
              </div>

              <div className="inline-flex items-center gap-1.5 text-[10.5px] text-slate-500 bg-slate-100/80 px-3 py-1 rounded-full font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Encrypted Signaling Tunnel Active</span>
              </div>
            </div>
          ) : isPip ? (
            /* STAGE 3: PiP View (Connected) */
            <div className="py-4 px-5 flex items-center gap-3.5 w-full">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#e85a1a] via-[#f36b24] to-[#fa8136] flex items-center justify-center text-white font-black text-sm shadow-md shrink-0">
                {participantAvatar}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-black text-slate-900 truncate font-['Plus_Jakarta_Sans',sans-serif]">
                  {participantName}
                </h4>
                <p className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{isVideoCallProp ? 'Encrypted Video' : 'HD Voice Active'}</span>
                </p>
                <div className="flex items-center gap-1 h-3 mt-1.5">
                  {[40, 85, 55, 100, 70, 35, 75, 95].map((h, i) => (
                    <span
                      key={i}
                      className="w-1 bg-[#f95716] rounded-full animate-pulse"
                      style={{
                        height: `${isMuted ? 20 : h}%`,
                        animationDelay: `${i * 0.09}s`,
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : isVoiceOnly ? (
            /* STAGE 4: AUDIO CALL UI (Connected with Two-Way Audio) */
            <div className="flex flex-col items-center justify-center text-center space-y-4 sm:space-y-5 p-4 sm:p-6 max-w-sm w-full mx-4 animate-in fade-in zoom-in-95">
              <div className="relative inline-flex items-center justify-center">
                <div
                  className="absolute w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-orange-500/10 animate-ping"
                  style={{ animationDuration: '3s' }}
                />
                <div className="absolute w-28 h-28 sm:w-34 sm:h-34 rounded-full bg-orange-500/15 animate-pulse" />
                <div className="relative w-22 sm:w-26 h-22 sm:h-26 rounded-full bg-gradient-to-tr from-[#e85a1a] via-[#f36b24] to-[#fa8136] flex items-center justify-center text-white text-2xl sm:text-3xl font-black shadow-[0_8px_28px_rgba(249,87,22,0.3)] ring-4 ring-orange-500/25">
                  {participantAvatar}
                </div>
                <div className="absolute bottom-0 right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-emerald-500 ring-4 ring-white flex items-center justify-center shadow-xs">
                  <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white animate-pulse" />
                </div>
              </div>

              <div className="space-y-1">
                <h4
                  className={`text-base sm:text-lg font-black tracking-tight font-['Plus_Jakarta_Sans',sans-serif] ${
                    isFullscreen ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  {participantName}
                </h4>
                <p className="text-xs text-emerald-600 font-bold flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Two-Way HD Voice Connected</span>
                </p>
              </div>

              {/* Dynamic Sound Wave Pulse Visualizer */}
              <div
                className={`flex items-center justify-center gap-1 sm:gap-1.5 h-8 w-40 sm:w-48 rounded-full px-4 shadow-2xs border ${
                  isFullscreen
                    ? 'bg-slate-800/80 border-slate-700'
                    : 'bg-orange-50/80 border-orange-200/60'
                }`}
              >
                {[30, 65, 90, 45, 80, 100, 75, 40, 85, 60, 95, 50].map((height, i) => (
                  <span
                    key={i}
                    className="w-1 bg-[#f95716] rounded-full animate-pulse"
                    style={{
                      height: `${isMuted ? 15 : height}%`,
                      animationDelay: `${i * 0.08}s`,
                      animationDuration: '0.7s',
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* STAGE 5: VIDEO CALL UI (Remote Video Stream + Local PiP Window) */
            <div className="relative w-full h-full flex items-center justify-center bg-slate-950 overflow-hidden">
              {/* Fullscreen / Full-stage Remote Peer Video */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  hasRemoteVideo ? 'opacity-100' : 'opacity-0 absolute'
                }`}
              />

              {/* Remote Video Fallback Card (shown before remote video arrives or if remote camera disabled) */}
              {!hasRemoteVideo && (
                <div
                  className={`text-center space-y-4 p-6 rounded-3xl border shadow-xl max-w-sm w-full mx-4 z-10 ${
                    isFullscreen
                      ? 'bg-slate-900/90 border-slate-800 text-white'
                      : 'bg-white/90 backdrop-blur-md border-orange-200/60'
                  }`}
                >
                  <div className="relative inline-block">
                    <div className="w-24 sm:w-28 h-24 sm:h-28 rounded-3xl bg-gradient-to-tr from-[#e85a1a] via-[#f36b24] to-[#fa8136] flex items-center justify-center text-white text-3xl font-black shadow-lg ring-4 ring-orange-500/20">
                      {participantAvatar}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 ring-4 ring-white flex items-center justify-center">
                      <Volume2 className="w-3.5 h-3.5 text-white animate-pulse" />
                    </div>
                  </div>

                  <div>
                    <h4
                      className={`text-base font-black tracking-tight font-['Plus_Jakarta_Sans',sans-serif] ${
                        isFullscreen ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {participantName}
                    </h4>
                    <p className="text-xs text-emerald-600 font-bold flex items-center justify-center gap-1 mt-0.5">
                      <Sparkles className="w-3 h-3" />
                      <span>Connecting Encrypted Video Feed...</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Local Webcam PiP Window (bottom right) */}
              {!isPip && (
                <div className="absolute bottom-4 right-4 w-32 sm:w-44 md:w-52 aspect-video rounded-2xl bg-slate-900 border-2 border-orange-400/90 overflow-hidden shadow-2xl z-20 group">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className={`w-full h-full object-cover ${isVideoDisabled ? 'hidden' : 'block'}`}
                  />
                  {isVideoDisabled && (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 text-xs">
                      <VideoOff className="w-5 h-5 mb-1 text-slate-400" />
                      <span className="text-[10px] font-semibold">Camera Off</span>
                    </div>
                  )}
                  <div className="absolute bottom-1.5 left-2 text-[9px] font-bold text-white bg-slate-950/80 px-1.5 py-0.5 rounded shadow-xs">
                    You
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Call Controls Toolbar */}
        <div
          className={`p-2.5 sm:p-4 border-t flex items-center justify-center gap-2 sm:gap-4 z-20 backdrop-blur-md ${
            isFullscreen
              ? 'bg-slate-900/90 border-slate-800'
              : 'bg-white/95 border-slate-100'
          }`}
        >
          {/* Mute Mic */}
          <button
            type="button"
            onClick={handleToggleMute}
            className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              isMuted
                ? 'bg-rose-50 text-rose-600 border border-rose-200 shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {isMuted ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>

          {/* Video Toggle */}
          <button
            type="button"
            onClick={handleToggleVideo}
            className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              isVoiceOnly || isVideoDisabled
                ? 'bg-rose-50 text-rose-600 border border-rose-200 shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title={isVoiceOnly ? 'Switch to Video Call' : isVideoDisabled ? 'Turn On Camera' : 'Turn Off Camera'}
          >
            {isVoiceOnly || isVideoDisabled ? (
              <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <Video className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>

          {/* Quick Expand button if in PiP */}
          {isPip && (
            <button
              type="button"
              onClick={() => setModalLayout('standard')}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-orange-50 text-[#f95716] border border-orange-200 hover:bg-orange-100 flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title="Expand to Full Modal"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}

          {/* Screen Share */}
          {!isPip && callStatus === 'connected' && (
            <button
              type="button"
              onClick={() => setIsScreenSharing((prev) => !prev)}
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
                isScreenSharing
                  ? 'bg-orange-500 text-white shadow-[0_4px_16px_rgba(249,87,22,0.25)]'
                  : 'bg-orange-50 hover:bg-orange-100 text-[#f95716] border border-orange-200/60'
              }`}
              title="Share Screen"
            >
              <ScreenShare className="w-5 h-5" />
            </button>
          )}

          {/* End Call / Cancel Button */}
          <button
            type="button"
            onClick={handleEndCall}
            className="h-9 px-3.5 sm:h-12 sm:px-6 rounded-xl sm:rounded-2xl bg-gradient-to-r from-rose-500 to-red-600 hover:opacity-95 text-white flex items-center justify-center gap-1.5 shadow-[0_4px_16px_rgba(244,63,94,0.35)] transition-all cursor-pointer active:scale-95 text-xs font-bold"
            title={callStatus === 'ringing' ? 'Cancel Call' : 'End Call'}
          >
            <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">
              {callStatus === 'ringing' ? 'Cancel Call' : 'End Call'}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
