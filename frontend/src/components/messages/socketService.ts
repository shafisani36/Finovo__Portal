import { io, Socket } from 'socket.io-client';

export interface CallSignalData {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string;
  receiverId?: string;
  receiverUserId?: string;
  conversationId?: number;
  isVideo: boolean;
  e2eeFingerprint: string;
}

type EventCallback = (...args: any[]) => void;

class MessageSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private isConnected = false;
  private channel: BroadcastChannel | null = null;
  private currentUserId: string | number | null = null;

  constructor() {
    this.initBroadcastChannel();
    this.initSocket();
  }

  public setUserId(userId: string | number) {
    this.currentUserId = userId;
    if (this.socket && this.socket.connected) {
      this.socket.emit('register_user', userId);
    }
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('finovo_collab_bus');
        this.channel.onmessage = (event) => {
          const { type, payload } = event.data || {};
          if (type) {
            this.emitLocal(type, payload);
          }
        };
      } catch {
        this.channel = null;
      }
    }
  }

  private broadcastCrossTab(type: string, payload: any) {
    if (this.channel) {
      try {
        this.channel.postMessage({ type, payload });
      } catch {
        // Fallback silently
      }
    }
  }

  private initSocket() {
    const defaultHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      `http://${defaultHost}:3001`;

    try {
      this.socket = io(socketUrl, {
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 5000,
        transports: ['websocket', 'polling'],
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        console.log(`[SocketService] Connected to real-time server at ${socketUrl} (${this.socket?.id})`);
        if (this.currentUserId) {
          this.socket?.emit('register_user', this.currentUserId);
        }
        this.emitLocal('connection_status', { connected: true });
      });

      this.socket.on('connect_error', (err) => {
        this.isConnected = false;
        console.warn(`[SocketService] Connection error:`, err?.message || err);
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
        this.emitLocal('connection_status', { connected: false });
      });

      this.socket.on('message', (data) => {
        this.emitLocal('new_message', data);
      });

      this.socket.on('typing', (data) => {
        this.emitLocal('user_typing', data);
      });

      this.socket.on('incoming_call', (data) => {
        this.emitLocal('incoming_call', data);
      });

      this.socket.on('call_answered', (data) => {
        this.emitLocal('call_answered', data);
      });

      this.socket.on('call_declined', (data) => {
        this.emitLocal('call_declined', data);
        this.emitLocal('call_ended', { ...data, reason: 'declined' });
      });

      this.socket.on('call_ended', (data) => {
        this.emitLocal('call_ended', data);
      });

      this.socket.on('webrtc_offer', (data) => {
        this.emitLocal('webrtc_offer', data);
        this.broadcastCrossTab('webrtc_offer', data);
      });

      this.socket.on('webrtc_answer', (data) => {
        this.emitLocal('webrtc_answer', data);
        this.broadcastCrossTab('webrtc_answer', data);
      });

      this.socket.on('webrtc_ice_candidate', (data) => {
        this.emitLocal('webrtc_ice_candidate', data);
        this.broadcastCrossTab('webrtc_ice_candidate', data);
      });

      this.socket.on('read_cursor_update', (data) => {
        this.emitLocal('read_cursor_updated', data);
      });
    } catch (err) {
      console.warn('[SocketService] Initialization error:', err);
      this.isConnected = false;
    }
  }

  public on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.off(event, callback);
  }

  public off(event: string, callback: EventCallback) {
    this.listeners.get(event)?.delete(callback);
  }

  public emitLocal(event: string, ...args: any[]) {
    this.listeners.get(event)?.forEach((cb) => {
      try {
        cb(...args);
      } catch (err) {
        console.error(`Error in event callback for ${event}:`, err);
      }
    });
  }

  public sendMessage(conversationId: number, message: any, conversation?: any) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('send_message', { conversationId, message, conversation });
    }
    // Broadcast to other open browser tabs
    this.broadcastCrossTab('new_message', { conversationId, message, conversation });
  }

  public sendTyping(conversationId: number, isTyping: boolean, userName: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('typing', { conversationId, isTyping, userName });
    }
    this.emitLocal('user_typing', { conversationId, isTyping, userName });
    this.broadcastCrossTab('user_typing', { conversationId, isTyping, userName });
  }

  public initiateCall(signal: CallSignalData) {
    // Strictly prevent self-calling
    if (signal.callerId && signal.receiverUserId && String(signal.callerId) === String(signal.receiverUserId)) {
      console.warn('[SocketService] Self-calling is prohibited. Aborting call initiation.');
      return;
    }

    if (this.socket && this.socket.connected) {
      this.socket.emit('call_initiate', signal);
    }
    this.emitLocal('call_initiated', signal);
    // Broadcast incoming_call to other tabs
    this.broadcastCrossTab('incoming_call', signal);
  }

  public answerCall(callId: string, callerId?: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('call_answer', { callId, callerId });
    }
    this.emitLocal('call_answered', { callId });
    this.broadcastCrossTab('call_answered', { callId });
  }

  public declineCall(callId: string, callerId?: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('call_declined', { callId, callerId });
    }
    this.emitLocal('call_declined', { callId });
    this.emitLocal('call_ended', { callId, reason: 'declined' });
    this.broadcastCrossTab('call_declined', { callId });
    this.broadcastCrossTab('call_ended', { callId, reason: 'declined' });
  }

  public endCall(callId: string, callerId?: string, receiverUserId?: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('call_end', { callId, callerId, receiverUserId });
    }
    this.emitLocal('call_ended', { callId });
    this.broadcastCrossTab('call_ended', { callId });
  }

  public sendWebRtcOffer(callId: string, sdp: RTCSessionDescriptionInit, targetUserId?: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('webrtc_offer', { callId, sdp, targetUserId });
    }
    this.broadcastCrossTab('webrtc_offer', { callId, sdp, targetUserId });
  }

  public sendWebRtcAnswer(callId: string, sdp: RTCSessionDescriptionInit, targetUserId?: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('webrtc_answer', { callId, sdp, targetUserId });
    }
    this.broadcastCrossTab('webrtc_answer', { callId, sdp, targetUserId });
  }

  public sendWebRtcIceCandidate(callId: string, candidate: RTCIceCandidateInit, targetUserId?: string) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('webrtc_ice_candidate', { callId, candidate, targetUserId });
    }
    this.broadcastCrossTab('webrtc_ice_candidate', { callId, candidate, targetUserId });
  }

  public sendReadCursor(conversationId: number, userId: string | number, sequenceNumber: number) {
    if (this.socket && this.socket.connected) {
      this.socket.emit('read_cursor_update', { conversationId, userId, sequenceNumber });
    }
    this.emitLocal('read_cursor_updated', { conversationId, userId, sequenceNumber });
    this.broadcastCrossTab('read_cursor_updated', { conversationId, userId, sequenceNumber });
  }

  public getStatus() {
    return this.isConnected;
  }
}

export const socketService = new MessageSocketService();
