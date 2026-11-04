import api from '../../lib/api';
import { UserPresence } from './types';

type PresenceListener = (presenceMap: Record<string, UserPresence>) => void;

class PresenceService {
  private companySlug: string | null = null;
  private currentUserId: string | number | null = null;
  private presenceMap: Record<string, UserPresence> = {};
  private listeners: Set<PresenceListener> = new Set();
  private pingInterval: number | null = null;
  private pollInterval: number | null = null;
  private idleTimeout: number | null = null;
  private isIdle = false;
  private isHidden = false;
  private broadcastChannel: BroadcastChannel | null = null;
  private initialized = false;

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('finovo_presence_sync');
        this.broadcastChannel.onmessage = (event) => {
          if (event.data?.type === 'user_presence_change' && event.data.presence) {
            const { userId, status, lastSeenHuman } = event.data.presence;
            this.updateLocalPresence(String(userId), {
              userId,
              status,
              isOnline: status === 'online',
              lastSeenHuman: lastSeenHuman || (status === 'online' ? 'Active Now' : status === 'away' ? 'Away' : 'Offline'),
            });
          }
        };
      } catch {
        // Fallback gracefully if BroadcastChannel is restricted
      }
    }
  }

  public init(companySlug: string, currentUserId: string | number) {
    if (!companySlug || !currentUserId) return;

    const slugChanged = this.companySlug !== companySlug;
    this.companySlug = companySlug;
    this.currentUserId = currentUserId;

    if (!this.initialized || slugChanged) {
      this.initialized = true;
      this.setupActivityTracking();
      this.startHeartbeat();
      this.fetchPresence();
    }
  }

  private setupActivityTracking() {
    if (typeof window === 'undefined') return;

    const resetIdleTimer = () => {
      if (this.isIdle) {
        this.isIdle = false;
        this.sendHeartbeat('online');
      }
      if (this.idleTimeout) {
        window.clearTimeout(this.idleTimeout);
      }
      // 2 minutes of inactivity marks user as away
      this.idleTimeout = window.setTimeout(() => {
        this.isIdle = true;
        this.sendHeartbeat('away');
      }, 120000);
    };

    const handleVisibilityChange = () => {
      this.isHidden = document.hidden;
      if (this.isHidden) {
        this.sendHeartbeat('away');
      } else {
        this.isIdle = false;
        this.sendHeartbeat('online');
      }
    };

    window.addEventListener('mousemove', resetIdleTimer, { passive: true });
    window.addEventListener('keydown', resetIdleTimer, { passive: true });
    window.addEventListener('touchstart', resetIdleTimer, { passive: true });
    window.addEventListener('scroll', resetIdleTimer, { passive: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    window.addEventListener('beforeunload', () => {
      this.sendBeaconOffline();
    });

    resetIdleTimer();
  }

  private startHeartbeat() {
    if (this.pingInterval) window.clearInterval(this.pingInterval);
    if (this.pollInterval) window.clearInterval(this.pollInterval);

    // Initial ping
    this.sendHeartbeat('online');

    // Heartbeat ping every 25 seconds
    this.pingInterval = window.setInterval(() => {
      const currentStatus = this.isHidden || this.isIdle ? 'away' : 'online';
      this.sendHeartbeat(currentStatus);
    }, 25000);

    // Poll full company presence directory every 20 seconds
    this.pollInterval = window.setInterval(() => {
      this.fetchPresence();
    }, 20000);
  }

  public async sendHeartbeat(status: 'online' | 'away' | 'offline') {
    if (!this.companySlug || !this.currentUserId) return;

    try {
      await api.post(`/companies/${this.companySlug}/collaboration/presence/ping`, {
        status,
      });

      // Update current user's local presence immediately
      this.updateLocalPresence(String(this.currentUserId), {
        userId: this.currentUserId,
        status,
        isOnline: status === 'online',
        lastSeenHuman: status === 'online' ? 'Active Now' : status === 'away' ? 'Away' : 'Offline',
      });

      // Broadcast to other tabs
      try {
        this.broadcastChannel?.postMessage({
          type: 'user_presence_change',
          presence: {
            userId: this.currentUserId,
            status,
            lastSeenHuman: status === 'online' ? 'Active Now' : status === 'away' ? 'Away' : 'Offline',
          },
        });
      } catch {
        // Safe fallback
      }
    } catch {
      // Background presence heartbeat failover
    }
  }

  private sendBeaconOffline() {
    if (!this.companySlug) return;
    try {
      const url = `/api/v1/companies/${this.companySlug}/collaboration/presence/ping`;
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      // Use keepalive fetch
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: 'offline' }),
        keepalive: true,
      });
    } catch {
      // Beacon fallback
    }
  }

  public async fetchPresence() {
    if (!this.companySlug) return;

    try {
      const res = await api.get(`/companies/${this.companySlug}/collaboration/presence`);
      const backendPresence = res.data?.presence || {};

      const nextMap: Record<string, UserPresence> = { ...this.presenceMap };

      Object.entries(backendPresence).forEach(([uId, data]: [string, any]) => {
        // If it's the current user, don't overwrite if we know we are currently active in this tab
        if (String(uId) === String(this.currentUserId) && !this.isIdle && !this.isHidden) {
          nextMap[uId] = {
            userId: uId,
            status: 'online',
            isOnline: true,
            lastSeenHuman: 'Active Now',
          };
          return;
        }

        nextMap[uId] = {
          userId: uId,
          status: data.status || 'offline',
          isOnline: data.is_online ?? data.status === 'online',
          lastSeenAt: data.last_seen_at,
          lastSeenHuman: data.last_seen_human || (data.status === 'online' ? 'Active Now' : 'Offline'),
        };
      });

      this.presenceMap = nextMap;
      this.notifyListeners();
    } catch {
      // Directory presence poll failover
    }
  }

  private updateLocalPresence(userId: string, presence: UserPresence) {
    this.presenceMap[userId] = presence;
    this.notifyListeners();
  }

  public getPresence(userId: string | number): UserPresence {
    const idStr = String(userId);
    if (this.presenceMap[idStr]) {
      return this.presenceMap[idStr];
    }
    // If it's the current user, they are online right now
    if (String(this.currentUserId) === idStr && !this.isIdle && !this.isHidden) {
      return {
        userId,
        status: 'online',
        isOnline: true,
        lastSeenHuman: 'Active Now',
      };
    }
    return {
      userId,
      status: 'offline',
      isOnline: false,
      lastSeenHuman: 'Offline',
    };
  }

  public getAllPresence(): Record<string, UserPresence> {
    return { ...this.presenceMap };
  }

  public subscribe(listener: PresenceListener): () => void {
    this.listeners.add(listener);
    // Send immediate initial state
    listener({ ...this.presenceMap });
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    const copy = { ...this.presenceMap };
    this.listeners.forEach((listener) => {
      try {
        listener(copy);
      } catch (e) {
        console.error('Error in presence listener:', e);
      }
    });
  }

  public destroy() {
    if (this.pingInterval) window.clearInterval(this.pingInterval);
    if (this.pollInterval) window.clearInterval(this.pollInterval);
    if (this.idleTimeout) window.clearTimeout(this.idleTimeout);
    this.sendBeaconOffline();
  }
}

export const presenceService = new PresenceService();
