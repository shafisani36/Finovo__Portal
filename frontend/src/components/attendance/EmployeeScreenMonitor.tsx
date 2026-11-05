import React, { useEffect, useRef, useState } from 'react';
import { Laptop } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

/**
 * Invisible Background Attendance Screen Capture Listener.
 *
 * Runs silently in the background for active employee sessions:
 * 1. Has ZERO visible widgets or screen-share buttons.
 * 2. When an enterprise administrator clicks "Take Screenshot", it silently grabs
 *    the active full-screen video frame from the stream established at Clock In.
 * 3. Never produces mock/synthetic drawings — only authentic, pixel-perfect real screen captures.
 */
export const EmployeeScreenMonitor: React.FC = () => {
  const { activeCompany } = useAuth();
  const [urgentRequest, setUrgentRequest] = useState<{ requestId: string; recordId: number } | null>(null);
  const isCapturingRef = useRef(false);

  // Supervisors and admins take screenshots; they are not monitored
  const isAdminUser = React.useMemo(() => {
    if (!activeCompany) return false;
    const roleSlugs = activeCompany.roles?.map((r) => r.slug.toLowerCase()) || [];
    return (
      roleSlugs.some(
        (s) =>
          s === 'company-owner' ||
          s === 'company-admin' ||
          s === 'admin' ||
          s === 'project-manager' ||
          s === 'hr-officer'
      ) || activeCompany.permissions?.includes('attendance.manage')
    );
  }, [activeCompany]);

  /**
   * Captures a genuine full-resolution frame from the active MediaStream.
   */
  const captureStreamFrame = async (stream: MediaStream): Promise<string | null> => {
    const track = stream.getVideoTracks().find((t) => t.readyState === 'live');
    if (!track) return null;

    // 1. ImageCapture API (instant GPU frame grab in Chromium)
    if ('ImageCapture' in window) {
      try {
        const imageCapture = new (window as any).ImageCapture(track);
        const bitmap = await imageCapture.grabFrame();
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(bitmap, 0, 0);
          return canvas.toDataURL('image/png', 0.92);
        }
      } catch (err) {
        console.warn('[ScreenMonitor] ImageCapture fallback:', err);
      }
    }

    // 2. High-speed Video element fallback
    return new Promise<string | null>((resolve) => {
      const video = document.createElement('video');
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;

      let resolved = false;
      const finish = () => {
        if (resolved) return;
        resolved = true;
        try {
          const w = video.videoWidth || 1920;
          const h = video.videoHeight || 1080;
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            resolve(canvas.toDataURL('image/png', 0.92));
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        } finally {
          video.srcObject = null;
        }
      };

      video.onloadeddata = () => setTimeout(finish, 80);
      video.play().catch(() => {});
      setTimeout(finish, 400);
    });
  };

  /**
   * If screen stream was disconnected (e.g. browser refreshed while clocked in),
   * this fulfills the admin's capture request on one click.
   */
  const handleConfirmScreenForCapture = async () => {
    if (!urgentRequest) return;
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) return;

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: false,
      });

      (window as any).__finovo_active_stream = stream;
      stream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          (window as any).__finovo_active_stream = null;
        };
      });

      const dataUrl = await captureStreamFrame(stream);
      if (dataUrl) {
        await api.post('/api/v1/attendance/employee/submit-screenshot', {
          request_id: urgentRequest.requestId,
          record_id: urgentRequest.recordId,
          image: dataUrl,
          page_url: window.location.pathname,
          page_title: document.title,
        });
      }
      setUrgentRequest(null);
    } catch {
      setUrgentRequest(null);
    }
  };

  // Heartbeat loop: Checks for admin screenshot requests every 1 second
  useEffect(() => {
    if (isAdminUser) return;

    let isMounted = true;

    const checkStatusAndRequests = async () => {
      if (isCapturingRef.current) return;

      try {
        const res = await api.get('/api/v1/attendance/employee/check-screenshot-request');
        if (!isMounted) return;

        const data = res.data;

        // Admin requested a live screenshot
        if (data?.has_request && data?.request_id && data?.record_id) {
          isCapturingRef.current = true;
          const { request_id, record_id } = data;

          const activeStream = (window as any).__finovo_active_stream as MediaStream | undefined;
          if (activeStream && activeStream.active && activeStream.getVideoTracks().some((t) => t.readyState === 'live')) {
            // Silently capture frame from stream without interrupting employee
            const capturedDataUrl = await captureStreamFrame(activeStream);
            if (capturedDataUrl) {
              await api.post('/api/v1/attendance/employee/submit-screenshot', {
                request_id,
                record_id,
                image: capturedDataUrl,
                page_url: window.location.pathname,
                page_title: document.title,
              });
            }
          } else {
            // Stream was not active (e.g. employee refreshed tab while clocked in)
            setUrgentRequest({ requestId: request_id, recordId: record_id });
          }
        }
      } catch {
        // Silent poll error catch
      } finally {
        isCapturingRef.current = false;
      }
    };

    const interval = setInterval(checkStatusAndRequests, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isAdminUser]);

  if (isAdminUser) {
    return null;
  }

  // Only render if stream was missing and admin is actively waiting for screenshot
  if (!urgentRequest) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center animate-in zoom-in-95 duration-200">
        <div className="w-12 h-12 bg-orange-100 text-[#F95716] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
          <Laptop className="w-6 h-6" />
        </div>

        <h3 className="text-base font-bold text-slate-900 font-['Plus_Jakarta_Sans',sans-serif]">
          Attendance Verification
        </h3>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
          Administrator is verifying active attendance. Click below to confirm your work screen.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={handleConfirmScreenForCapture}
            className="w-full py-2.5 bg-[#F95716] hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer"
          >
            Confirm Work Screen
          </button>
          <button
            type="button"
            onClick={() => setUrgentRequest(null)}
            className="text-xs text-slate-400 hover:text-slate-600 py-1"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
