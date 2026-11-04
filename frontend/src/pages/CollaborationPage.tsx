import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  MessageSquare,
  Plus,
  Users,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  Sparkles,
  Lock,
} from 'lucide-react';
import { AppShell } from '../components/layouts/AppShell';
import { Conversation, ChatMessage, MeetingItem, CallLogItem } from '../components/messages/types';
import { ConversationListPanel } from '../components/messages/ConversationListPanel';
import { ActiveChatPanel } from '../components/messages/ActiveChatPanel';
import { ConversationDetailsPanel } from '../components/messages/ConversationDetailsPanel';
import { VideoCallModal } from '../components/messages/VideoCallModal';
import { IncomingCallModal, IncomingCallSignal } from '../components/messages/IncomingCallModal';
import { ArrangeMeetingModal } from '../components/messages/ArrangeMeetingModal';
import { NewConversationModal } from '../components/messages/NewConversationModal';
import { socketService } from '../components/messages/socketService';
import { presenceService } from '../components/messages/presenceService';
import { useAuth } from '../context/AuthContext';
import api from '../lib/api';
import { dataPipeline } from '../lib/dataPipeline';

export const CollaborationPage: React.FC = () => {
  const { companySlug, roomId } = useParams<{ companySlug: string; roomId?: string }>();
  const { user: currentUser } = useAuth();

  // Instant SWR-cached state initialization (0ms rendering for returning/cached visits)
  const [conversations, setConversations] = useState<Conversation[]>(() => {
    return (companySlug && dataPipeline.get<Conversation[]>(`collab_conversations_${companySlug}`)) || [];
  });
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(() => {
    const cachedConvs = (companySlug && dataPipeline.get<Conversation[]>(`collab_conversations_${companySlug}`)) || [];
    return cachedConvs.length > 0 ? cachedConvs[0] : null;
  });
  const [messagesByConversation, setMessagesByConversation] = useState<Record<number, ChatMessage[]>>(() => {
    return (companySlug && dataPipeline.get<Record<number, ChatMessage[]>>(`collab_messages_${companySlug}`)) || {};
  });

  // Real company directory members for creating new chats
  const [availableMembers, setAvailableMembers] = useState<
    Array<{ id: string | number; name: string; role?: string; email?: string; status?: 'online' | 'offline' | 'away'; lastSeenHuman?: string }>
  >(() => {
    return (companySlug && dataPipeline.get<any[]>(`collab_members_${companySlug}`)) || [];
  });

  // Advanced Read Cursor Tracking: Map of conversationId -> highest read sequence number
  const [readCursors, setReadCursors] = useState<Record<number, number>>({});

  // UI Modal & Drawer States
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [incomingCallData, setIncomingCallData] = useState<IncomingCallSignal | null>(null);
  const [isArrangeMeetingOpen, setIsArrangeMeetingOpen] = useState(false);
  const [isNewConversationOpen, setIsNewConversationOpen] = useState(false);
  const [isCallVideo, setIsCallVideo] = useState(true);
  const [isPeerTyping, setIsPeerTyping] = useState(false);
  const [activeMobileView, setActiveMobileView] = useState<'list' | 'chat' | 'details'>('chat');
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const cached = companySlug ? dataPipeline.get<Conversation[]>(`collab_conversations_${companySlug}`) : null;
    return !cached || cached.length === 0;
  });

  // Active call refs for robust real-time synchronization
  const activeCallIdRef = useRef<string | null>(null);
  const isVideoCallOpenRef = useRef(isVideoCallOpen);
  const incomingCallDataRef = useRef(incomingCallData);
  const readCursorsRef = useRef(readCursors);
  const messagesByConversationRef = useRef(messagesByConversation);
  const lastSyncedCursorRef = useRef<Record<number, number>>({});

  useEffect(() => {
    isVideoCallOpenRef.current = isVideoCallOpen;
  }, [isVideoCallOpen]);

  useEffect(() => {
    incomingCallDataRef.current = incomingCallData;
  }, [incomingCallData]);

  useEffect(() => {
    readCursorsRef.current = readCursors;
  }, [readCursors]);

  useEffect(() => {
    messagesByConversationRef.current = messagesByConversation;
  }, [messagesByConversation]);

  // Register current user on real-time Socket.IO server
  useEffect(() => {
    if (currentUser?.id) {
      socketService.setUserId(currentUser.id);
    }
  }, [currentUser?.id]);

  // Gentle Fallback Poller: Only polls if an active call is pending or socket disconnected
  useEffect(() => {
    if (!companySlug || !currentUser?.id) return;

    const poller = setInterval(async () => {
      // If socket is connected and no active call session, WebSocket handles everything in real-time
      const hasActiveCall = Boolean(activeCallIdRef.current);
      const isSocketConnected = socketService.getStatus();

      if (!hasActiveCall && isSocketConnected) {
        return;
      }

      try {
        const activeCallId = activeCallIdRef.current;
        const res = await api.get(
          `/companies/${companySlug}/collaboration/calls/active${activeCallId ? `?call_id=${activeCallId}` : ''}`
        );
        const { incoming_call, call_state } = res.data || {};

        // Trigger incoming call modal if there's a pending call targeted to this user
        if (incoming_call && !isVideoCallOpenRef.current && !incomingCallDataRef.current) {
          if (String(incoming_call.receiverUserId) === String(currentUser.id)) {
            setIncomingCallData(incoming_call);
          }
        }

        // Synchronize call state with peer actions (answered, declined, ended)
        if (activeCallId && call_state) {
          if (call_state.status === 'answered') {
            socketService.emitLocal('call_answered', { callId: activeCallId });
          } else if (call_state.status === 'declined') {
            socketService.emitLocal('call_declined', { callId: activeCallId });
          } else if (call_state.status === 'ended') {
            socketService.emitLocal('call_ended', { callId: activeCallId });
          }
        }
      } catch {
        // Non-blocking
      }
    }, 2500);

    return () => clearInterval(poller);
  }, [companySlug, currentUser?.id]);

  // Active messages in the selected conversation
  const activeMessages = activeConversation ? messagesByConversation[activeConversation.id] || [] : [];

  // Auto-launch room if navigated to via /meet/:roomId
  useEffect(() => {
    if (roomId) {
      setIsCallVideo(true);
      setIsVideoCallOpen(true);
    }
  }, [roomId]);

  // =========================================================================
  // 1. DATA INITIALIZATION & BACKEND API LOADING
  // =========================================================================

  useEffect(() => {
    if (!companySlug) return;
    loadConversationsAndMembers();
  }, [companySlug]);

  // Real-Time Presence Synchronization
  useEffect(() => {
    if (!companySlug || !currentUser?.id) return;
    presenceService.init(companySlug, currentUser.id);

    const unsubscribe = presenceService.subscribe((presenceMap) => {
      setConversations((prevConvs) => {
        return prevConvs.map((conv) => {
          if (conv.type === 'direct') {
            const other = conv.members.find((m) => String(m.id) !== String(currentUser.id));
            if (other) {
              const p = presenceMap[String(other.id)] || presenceService.getPresence(other.id);
              return {
                ...conv,
                status: p.status,
                lastSeenAt: p.lastSeenAt || conv.lastSeenAt,
                lastSeenHuman: p.lastSeenHuman || conv.lastSeenHuman,
                members: conv.members.map((m) =>
                  String(m.id) === String(other.id)
                    ? { ...m, status: p.status, lastSeenHuman: p.lastSeenHuman }
                    : m
                ),
              };
            }
          } else {
            let onlineCount = 0;
            const updatedMembers = conv.members.map((m) => {
              const p = presenceMap[String(m.id)] || presenceService.getPresence(m.id);
              if (p.isOnline) onlineCount++;
              return { ...m, status: p.status, lastSeenHuman: p.lastSeenHuman };
            });
            return {
              ...conv,
              status: onlineCount > 0 ? 'online' : 'offline',
              onlineMembersCount: onlineCount,
              totalMembersCount: conv.members.length,
              members: updatedMembers,
            };
          }
          return conv;
        });
      });

      setActiveConversation((prevActive) => {
        if (!prevActive) return null;
        if (prevActive.type === 'direct') {
          const other = prevActive.members.find((m) => String(m.id) !== String(currentUser.id));
          if (other) {
            const p = presenceMap[String(other.id)] || presenceService.getPresence(other.id);
            return {
              ...prevActive,
              status: p.status,
              lastSeenAt: p.lastSeenAt || prevActive.lastSeenAt,
              lastSeenHuman: p.lastSeenHuman || prevActive.lastSeenHuman,
              members: prevActive.members.map((m) =>
                String(m.id) === String(other.id)
                  ? { ...m, status: p.status, lastSeenHuman: p.lastSeenHuman }
                  : m
              ),
            };
          }
        } else {
          let onlineCount = 0;
          const updatedMembers = prevActive.members.map((m) => {
            const p = presenceMap[String(m.id)] || presenceService.getPresence(m.id);
            if (p.isOnline) onlineCount++;
            return { ...m, status: p.status, lastSeenHuman: p.lastSeenHuman };
          });
          return {
            ...prevActive,
            status: onlineCount > 0 ? 'online' : 'offline',
            onlineMembersCount: onlineCount,
            totalMembersCount: prevActive.members.length,
            members: updatedMembers,
          };
        }
        return prevActive;
      });

      // Update availableMembers presence state
      setAvailableMembers((prevMembers) =>
        prevMembers.map((m) => {
          const p = presenceMap[String(m.id)] || presenceService.getPresence(m.id);
          return {
            ...m,
            status: p.status,
            lastSeenHuman: p.lastSeenHuman,
          };
        })
      );
    });

    return () => {
      unsubscribe();
    };
  }, [companySlug, currentUser?.id]);

  const loadMembersInBackground = async (slug: string) => {
    try {
      let memberList: any[] = [];
      try {
        const empRes = await api.get(`/companies/${slug}/employees?per_page=100`);
        const data = empRes.data?.employees?.data || empRes.data?.employees || empRes.data?.data;
        if (Array.isArray(data) && data.length > 0) {
          memberList = data;
        }
      } catch {
        // Fall back to members directory
      }

      if (memberList.length === 0) {
        try {
          const memRes = await api.get(`/companies/${slug}/members?per_page=100`);
          const data = memRes.data?.data || memRes.data?.members || memRes.data;
          if (Array.isArray(data) && data.length > 0) {
            memberList = data;
          }
        } catch (e) {
          console.error('Failed to load company members:', e);
        }
      }

      const mapped = memberList
        .map((item: any) => {
          const userId = item.user?.id || item.user_id || item.id;
          const userName = item.user?.name || item.name || 'Colleague';
          const userEmail = item.user?.email || item.email;
          const userRole =
            item.designation?.name ||
            item.roles?.[0]?.name ||
            item.department?.name ||
            item.role ||
            'Team Member';

          const p = presenceService.getPresence(userId);

          return {
            id: userId,
            name: userName,
            role: userRole,
            email: userEmail,
            status: p.status,
            lastSeenHuman: p.lastSeenHuman,
          };
        })
        .filter((m) => Boolean(m.id));

      setAvailableMembers(mapped);
      dataPipeline.set(`collab_members_${slug}`, mapped);
    } catch (err) {
      console.error('Failed to load organization employees:', err);
    }
  };

  const loadConversationsAndMembers = async () => {
    if (conversations.length === 0) {
      setIsLoading(true);
    }
    try {
      // 1. Fetch real company conversations
      const convRes = await api.get(`/companies/${companySlug}/collaboration/conversations`);
      const apiConvs = convRes.data?.conversations || [];

      // Initialize read cursors from backend cursors if present
      const initialCursors: Record<number, number> = {};

      const formattedConvs: Conversation[] = apiConvs.map((c: any) => {
        const lastReadSeq = c.last_read_sequence || 0;
        initialCursors[c.id] = lastReadSeq;

        // Sequence-based precise unread count
        const unreadCount = c.unread_count !== undefined ? c.unread_count : 0;

        const otherMember =
          c.type === 'direct'
            ? c.members?.find((m: any) => String(m.user?.id || m.user_id || m.id) !== String(currentUser?.id))
            : null;

        const convName =
          c.type === 'direct'
            ? (otherMember?.user?.name || otherMember?.name || c.title || 'Colleague')
            : (c.title || 'Team Channel');

        const initialStatus =
          (c.status as 'online' | 'away' | 'offline') ||
          (otherMember ? presenceService.getPresence(otherMember.user?.id || otherMember.id).status : 'offline');

        return {
          id: c.id,
          name: convName,
          type: c.type || 'direct',
          avatar: convName.substring(0, 2).toUpperCase(),
          avatarColor: 'bg-orange-50 text-[#f95716] border-orange-200',
          status: initialStatus,
          lastMessage: c.latest_message?.body || c.messages?.[0]?.body || '',
          lastMessageTime: c.last_message_at
            ? new Date(c.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '',
          unreadCount,
          lastSequenceNumber: c.last_sequence_number || 0,
          lastReadSequence: lastReadSeq,
          onlineMembersCount: c.online_members_count,
          totalMembersCount: c.total_members_count || c.members?.length,
          lastSeenAt: c.last_seen_at,
          lastSeenHuman: c.last_seen_human,
          members:
            c.members?.map((m: any) => {
              const uId = String(m.user?.id || m.user_id || m.id);
              const p = m.presence || presenceService.getPresence(uId);
              return {
                id: uId,
                name: m.user?.name || 'Team Member',
                avatar: (m.user?.name || 'M')[0].toUpperCase(),
                role: m.membership_type || m.role || 'Member',
                email: m.user?.email,
                status: p.status || m.status || 'offline',
                lastSeenHuman: p.last_seen_human || m.last_seen_human,
              };
            }) || [],
        };
      });

      setConversations(formattedConvs);
      if (companySlug) {
        dataPipeline.set(`collab_conversations_${companySlug}`, formattedConvs);
      }
      setReadCursors(initialCursors);

      // Fast UI unlock - don't block on secondary member loads
      setIsLoading(false);

      if (formattedConvs.length > 0) {
        setActiveConversation((prevActive) => {
          if (prevActive) {
            const found = formattedConvs.find((c) => c.id === prevActive.id);
            if (found) {
              loadMessages(found.id, initialCursors[found.id] || 0);
              return found;
            }
          }
          const first = formattedConvs[0];
          loadMessages(first.id, initialCursors[first.id] || 0);
          return first;
        });
      } else {
        setActiveConversation(null);
      }

      // 2. Fetch employee directory non-blocking in background
      if (companySlug) {
        loadMembersInBackground(companySlug);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
      setIsLoading(false);
    }
  };

  // Load real messages for a conversation from the API
  const loadMessages = async (conversationId: number, currentReadSeq: number) => {
    try {
      const res = await api.get(`/companies/${companySlug}/collaboration/conversations/${conversationId}/messages`);
      const apiMessages = res.data?.data || (Array.isArray(res.data) ? res.data : []);
      const peerReadSeq = res.data?.peer_read_sequence ?? 0;

      const formattedMessages: ChatMessage[] = apiMessages.map((m: any) => {
        const isMsgFromMe = currentUser
          ? Number(m.sender_id) === Number(currentUser.id)
          : m.sender_id === (res.data?.current_user_id || m.sender_id);

        // Reconstruct callLogDetails from metadata or body fallback
        let callLogDetails: CallLogItem | undefined = m.metadata?.call_log_details;
        if (
          !callLogDetails &&
          (m.message_type === 'call_log' ||
            /((voice|video)\s*call\s*(ended|missed)|missed\s*(voice|video)?\s*call)/i.test(m.body || '') ||
            /📞|📹/.test(m.body || ''))
        ) {
          const isVideo = /video/i.test(m.body || '') || /📹/.test(m.body || '');
          const isMissed = /missed/i.test(m.body || '');
          const durationMatch = (m.body || '').match(/(\d{1,2}:\d{2})/);
          const durationStr = durationMatch ? durationMatch[1] : undefined;
          const durationSeconds = durationStr
            ? parseInt(durationStr.split(':')[0], 10) * 60 + parseInt(durationStr.split(':')[1], 10)
            : 0;

          callLogDetails = {
            id: `call_${m.id}`,
            type: isVideo ? 'video' : 'audio',
            status: isMissed ? 'missed' : 'completed',
            duration: durationStr,
            durationSeconds,
            timestamp: m.created_at
              ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Recently',
            date: m.created_at
              ? new Date(m.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
              : undefined,
            callerName: isMsgFromMe ? 'You' : m.sender?.name || 'Colleague',
            receiverName: isMsgFromMe ? 'Colleague' : 'You',
            isMeCaller: isMsgFromMe,
          };
        }

        // Reconstruct meetingDetails from metadata
        const meetingDetails: MeetingItem | undefined = m.metadata?.meeting_details;

        return {
          id: m.id,
          conversationId,
          sequenceNumber: m.sequence_number || m.id,
          senderId: String(m.sender_id),
          senderName: m.sender?.name || (isMsgFromMe ? 'You' : 'Colleague'),
          senderAvatar: (m.sender?.name || (isMsgFromMe ? 'Y' : 'U'))[0].toUpperCase(),
          body: m.body,
          timestamp: new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isMe: isMsgFromMe,
          isRead: isMsgFromMe ? (m.sequence_number || 0) <= peerReadSeq : true,
          isPinned: m.is_pinned || false,
          isDeleted: m.is_deleted || false,
          isEdited: m.is_edited || false,
          callLogDetails,
          meetingDetails,
          replyTo: m.reply_to
            ? {
                id: m.reply_to.id,
                sender: m.reply_to.sender?.name || 'Colleague',
                text: m.reply_to.body,
              }
            : undefined,
          reactions: m.reactions?.map((r: any) => ({
            emoji: r.reaction,
            count: 1,
            userReacted: false,
          })),
        };
      });

      setMessagesByConversation((prev) => {
        const next = {
          ...prev,
          [conversationId]: formattedMessages,
        };
        if (companySlug) {
          dataPipeline.set(`collab_messages_${companySlug}`, next);
        }
        return next;
      });

      // Immediately run read cursor logic for this active conversation
      markConversationAsRead(conversationId, formattedMessages);
    } catch (err) {
      console.error('Failed to load messages for conversation:', err);
    }
  };

  // =========================================================================
  // 2. ADVANCED READ / UNREAD CURSOR SYNCHRONIZATION ALGORITHM
  // =========================================================================

  /**
   * Advanced Read Algorithm:
   * 1. Evaluates all messages currently in the thread and finds max sequence number.
   * 2. If maxSeq > current read cursor, advances local cursor and dispatches cursor update to API.
   * 3. Resets conversation unreadCount to 0.
   * 4. Updates all message read indicators.
   */
  const markConversationAsRead = useCallback(
    (conversationId: number, messagesList?: ChatMessage[]) => {
      const list = messagesList || messagesByConversationRef.current[conversationId] || [];
      if (list.length === 0) return;

      const maxSeq = list.reduce((max, m) => Math.max(max, m.sequenceNumber || 0), 0);
      const currentCursor = readCursorsRef.current[conversationId] || 0;
      const lastSynced = lastSyncedCursorRef.current[conversationId] || 0;

      if (maxSeq > currentCursor) {
        // 1. Advance local cursor
        setReadCursors((prev) => ({ ...prev, [conversationId]: maxSeq }));

        // 2. Reset unread count on conversation
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  unreadCount: 0,
                  lastReadSequence: maxSeq,
                }
              : c
          )
        );

        // 3. Update messages isRead status
        setMessagesByConversation((prev) => {
          const current = prev[conversationId] || [];
          const updated = current.map((m) =>
            (m.sequenceNumber || 0) <= maxSeq ? { ...m, isRead: true } : m
          );
          return { ...prev, [conversationId]: updated };
        });

        // 4. Synchronize cursor with backend API only if not already posted
        if (companySlug && maxSeq > lastSynced) {
          lastSyncedCursorRef.current[conversationId] = maxSeq;
          api
            .post(`/companies/${companySlug}/collaboration/conversations/${conversationId}/read-cursor`, {
              sequence_number: maxSeq,
            })
            .catch(() => {});
        }

        // 5. Broadcast cursor update to peers
        if (currentUser) {
          socketService.sendReadCursor(conversationId, currentUser.id, maxSeq);
        }
      }
    },
    [companySlug, currentUser?.id]
  );

  // Switch Active Conversation Handler
  const handleSelectConversation = (conv: Conversation) => {
    setActiveConversation(conv);
    setActiveMobileView('chat');

    // Always revalidate fresh messages in background, displaying cached messages immediately
    loadMessages(conv.id, readCursors[conv.id] || 0);
  };

  // Window Focus / Tab Visibility Observer: Automatically mark active conversation as read
  useEffect(() => {
    const handleFocus = () => {
      if (activeConversation) {
        markConversationAsRead(activeConversation.id);
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && activeConversation) {
        markConversationAsRead(activeConversation.id);
      }
    });

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [activeConversation, markConversationAsRead]);

  // =========================================================================
  // 3. REAL-TIME SOCKET.IO SIGNALING & INCOMING MESSAGES
  // =========================================================================

  useEffect(() => {
    const unsubMessage = socketService.on('new_message', (data: any) => {
      if (data && data.message && data.conversationId) {
        const incomingMsg: ChatMessage = data.message;
        const convId = data.conversationId;
        const incomingConv = data.conversation;

        setMessagesByConversation((prev) => {
          const thread = prev[convId] || [];
          if (thread.some((m) => String(m.id) === String(incomingMsg.id))) {
            return prev;
          }
          return { ...prev, [convId]: [...thread, incomingMsg] };
        });

        // Advanced Unread Evaluation & Auto-Creation of missing chat card:
        setConversations((prev) => {
          const exists = prev.some((c) => c.id === convId);
          if (!exists) {
            // Auto-create & immediately insert the conversation into recipient's list!
            const newConvItem: Conversation = {
              id: convId,
              name: incomingMsg.senderName || incomingConv?.name || 'Direct Message',
              type: incomingConv?.type || 'direct',
              avatar: (incomingMsg.senderName || incomingConv?.name || 'DM').substring(0, 2).toUpperCase(),
              avatarColor: 'bg-orange-50 text-[#f95716] border-orange-200',
              status: 'online',
              lastMessage: incomingMsg.body,
              lastMessageTime: incomingMsg.timestamp || 'Just now',
              unreadCount: 1,
              lastSequenceNumber: incomingMsg.sequenceNumber || 1,
              lastReadSequence: 0,
              members: incomingConv?.members || [],
            };
            loadConversationsAndMembers();
            return [newConvItem, ...prev];
          }

          return prev.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  unreadCount:
                    activeConversation && activeConversation.id === convId && document.visibilityState === 'visible'
                      ? c.unreadCount
                      : c.unreadCount + 1,
                  lastMessage: incomingMsg.body,
                  lastMessageTime: incomingMsg.timestamp,
                }
              : c
          );
        });

        if (activeConversation && activeConversation.id === convId && document.visibilityState === 'visible') {
          markConversationAsRead(convId);
        }
      }
    });

    const unsubTyping = socketService.on('user_typing', (data: any) => {
      if (data && activeConversation && data.conversationId === activeConversation.id) {
        setIsPeerTyping(data.isTyping);
      }
    });

    const unsubCall = socketService.on('incoming_call', (data: IncomingCallSignal) => {
      if (!data) return;
      // If caller is myself, ignore
      if (currentUser?.id && String(data.callerId) === String(currentUser.id)) {
        return;
      }
      // If targeted to a specific receiver and not me, ignore
      if (data.receiverUserId && currentUser?.id && String(data.receiverUserId) !== String(currentUser.id)) {
        return;
      }
      setIncomingCallData(data);
    });

    const unsubReadCursor = socketService.on('read_cursor_updated', (data: any) => {
      if (data && data.conversationId && data.sequenceNumber !== undefined) {
        const convId = data.conversationId;
        const readSeq = data.sequenceNumber;

        // When a participant reads up to readSeq, all messages sent up to that sequence number become isRead: true
        setMessagesByConversation((prev) => {
          const thread = prev[convId];
          if (!thread) return prev;
          const updated = thread.map((m) =>
            (m.sequenceNumber || 0) <= readSeq ? { ...m, isRead: true } : m
          );
          return { ...prev, [convId]: updated };
        });
      }
    });

    return () => {
      unsubMessage();
      unsubTyping();
      unsubCall();
      unsubReadCursor();
    };
  }, [activeConversation, markConversationAsRead]);

  // =========================================================================
  // 4. MESSAGE DISPATCH, CALLS, AND MEETING SCHEDULING
  // =========================================================================

  const handleSendMessage = async (text: string, replyToId?: number | string) => {
    if (!activeConversation) return;

    const replyTarget = replyToId ? activeMessages.find((m) => m.id === replyToId) : undefined;
    const currentMaxSeq = activeMessages.reduce((max, m) => Math.max(max, m.sequenceNumber || 0), 0);
    const nextSeq = currentMaxSeq + 1;

    const newMessage: ChatMessage = {
      id: Date.now(),
      conversationId: activeConversation.id,
      sequenceNumber: nextSeq,
      senderId: String(currentUser?.id || 'me'),
      senderName: currentUser?.name || 'You',
      senderAvatar: (currentUser?.name || 'Y')[0].toUpperCase(),
      body: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
      isRead: false, // Initial state until peer's read cursor advances
      replyTo: replyTarget
        ? {
            id: replyTarget.id,
            sender: replyTarget.senderName,
            text: replyTarget.body,
          }
        : undefined,
    };

    // 1. Optimistic append to message thread
    setMessagesByConversation((prev) => ({
      ...prev,
      [activeConversation.id]: [...(prev[activeConversation.id] || []), newMessage],
    }));

    // 2. Advance sender's read cursor to new sequence number
    setReadCursors((prev) => ({ ...prev, [activeConversation.id]: nextSeq }));

    // 3. Update conversation list snippet
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversation.id
          ? {
              ...c,
              lastMessage: text,
              lastMessageTime: 'Just now',
              lastSequenceNumber: nextSeq,
              lastReadSequence: nextSeq,
            }
          : c
      )
    );

    // 4. Dispatch via socket service
    socketService.sendMessage(activeConversation.id, newMessage, activeConversation);

    // 5. Submit to backend API
    if (companySlug) {
      try {
        const res = await api.post(`/companies/${companySlug}/collaboration/conversations/${activeConversation.id}/messages`, {
          body: text,
          reply_to_message_id: replyToId ? Number(replyToId) : null,
        });
        const serverMsg = res.data?.data || res.data;
        if (serverMsg && serverMsg.id) {
          setMessagesByConversation((prev) => {
            const thread = prev[activeConversation.id] || [];
            return {
              ...prev,
              [activeConversation.id]: thread.map((m) =>
                m.id === newMessage.id
                  ? {
                      ...m,
                      id: serverMsg.id,
                      sequenceNumber: serverMsg.sequence_number || m.sequenceNumber,
                    }
                  : m
              ),
            };
          });
        }
      } catch (err) {
        console.error('Failed to dispatch message to API:', err);
      }
    }
  };

  const handleToggleReaction = async (messageId: number | string, emoji: string) => {
    if (!activeConversation) return;

    setMessagesByConversation((prev) => {
      const currentList = prev[activeConversation.id] || [];
      const updated = currentList.map((m) => {
        if (m.id !== messageId) return m;

        const currentReactions = m.reactions || [];
        const existing = currentReactions.find((r) => r.emoji === emoji);

        if (existing) {
          const nextReactions = currentReactions
            .map((r) =>
              r.emoji === emoji
                ? {
                    ...r,
                    count: r.userReacted ? r.count - 1 : r.count + 1,
                    userReacted: !r.userReacted,
                  }
                : r
            )
            .filter((r) => r.count > 0);
          return { ...m, reactions: nextReactions };
        } else {
          return {
            ...m,
            reactions: [...currentReactions, { emoji, count: 1, userReacted: true }],
          };
        }
      });
      return { ...prev, [activeConversation.id]: updated };
    });

    if (companySlug) {
      try {
        await api.post(
          `/companies/${companySlug}/collaboration/conversations/${activeConversation.id}/messages/${messageId}/reactions`,
          { reaction: emoji }
        );
      } catch {}
    }
  };

  const handleTogglePin = (messageId: number | string) => {
    if (!activeConversation) return;

    setMessagesByConversation((prev) => {
      const currentList = prev[activeConversation.id] || [];
      const updated = currentList.map((m) =>
        m.id === messageId ? { ...m, isPinned: !m.isPinned } : m
      );
      return { ...prev, [activeConversation.id]: updated };
    });
  };

  const handleEditMessage = async (messageId: number | string, newText: string) => {
    if (!activeConversation || !companySlug) return;

    // Optimistically update message body and edited flag
    setMessagesByConversation((prev) => {
      const list = prev[activeConversation.id] || [];
      const updated = list.map((m) =>
        m.id === messageId ? { ...m, body: newText, isEdited: true } : m
      );
      return { ...prev, [activeConversation.id]: updated };
    });

    try {
      await api.patch(
        `/companies/${companySlug}/collaboration/conversations/${activeConversation.id}/messages/${messageId}`,
        { body: newText }
      );
    } catch (err) {
      console.error('Failed to edit message:', err);
    }
  };

  const handleDeleteMessage = async (messageId: number | string) => {
    if (!activeConversation || !companySlug) return;

    // Optimistically remove from state
    setMessagesByConversation((prev) => {
      const list = prev[activeConversation.id] || [];
      const updated = list.filter((m) => m.id !== messageId);
      return { ...prev, [activeConversation.id]: updated };
    });

    try {
      await api.delete(
        `/companies/${companySlug}/collaboration/conversations/${activeConversation.id}/messages/${messageId}`
      );
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  };

  const handleBulkDeleteMessages = async (messageIds: (number | string)[]) => {
    if (!activeConversation || !companySlug || messageIds.length === 0) return;

    const idSet = new Set(messageIds);

    // Optimistically remove all selected messages
    setMessagesByConversation((prev) => {
      const list = prev[activeConversation.id] || [];
      const updated = list.filter((m) => !idSet.has(m.id));
      return { ...prev, [activeConversation.id]: updated };
    });

    try {
      await api.post(
        `/companies/${companySlug}/collaboration/conversations/${activeConversation.id}/messages/bulk-delete`,
        { message_ids: messageIds }
      );
    } catch (err) {
      console.error('Failed to bulk delete messages:', err);
    }
  };

  const handleStartCall = (isVideo: boolean) => {
    if (!activeConversation) return;
    const partner = activeConversation.members?.find((m) => String(m.id) !== String(currentUser?.id));
    // Strictly prevent self-calling
    if (activeConversation.type === 'direct' && (!partner || String(partner.id) === String(currentUser?.id))) {
      alert("Cannot initiate a call with yourself.");
      return;
    }
    const callId = `call_${Date.now()}`;
    activeCallIdRef.current = callId;
    setIsIncomingCall(false);
    setIsCallVideo(isVideo);
    setIncomingCallData(null);
    setIsVideoCallOpen(true);

    const signalData = {
      callId,
      callerId: String(currentUser?.id || 'me'),
      callerName: currentUser?.name || 'You',
      callerAvatar: (currentUser?.name || 'Y').substring(0, 2).toUpperCase(),
      receiverId: String(activeConversation.id),
      receiverUserId: partner ? String(partner.id) : undefined,
      conversationId: activeConversation.id,
      isVideo,
      e2eeFingerprint: '7F8A-92BC-44D1-0988-E2A4-71F0',
    };

    socketService.initiateCall(signalData);
    if (companySlug) {
      api.post(`/companies/${companySlug}/collaboration/calls/signal`, {
        action: 'initiate',
        signal: signalData,
      }).catch(() => {});
    }
  };

  const handleStartCallWithColleague = async (member: any, isVideo: boolean) => {
    if (String(member.id) === String(currentUser?.id)) {
      alert("Cannot initiate a call with yourself.");
      return;
    }

    // 1. Locate or dynamically provision direct conversation
    let targetConv = conversations.find(
      (c) => c.type === 'direct' && c.members?.some((m) => String(m.id) === String(member.id))
    );

    if (!targetConv && companySlug) {
      try {
        const res = await api.post(`/companies/${companySlug}/collaboration/conversations`, {
          type: 'direct',
          recipient_user_id: Number(member.id),
        });
        const createdData = res.data?.conversation || res.data;
        if (createdData && createdData.id) {
          targetConv = {
            id: createdData.id,
            name: member.name,
            type: 'direct',
            avatar: (member.name || 'C').substring(0, 2).toUpperCase(),
            avatarColor: 'bg-orange-50 text-[#f95716] border-orange-200',
            status: member.status || 'online',
            lastMessage: '',
            lastMessageTime: '',
            unreadCount: 0,
            lastSequenceNumber: 0,
            lastReadSequence: 0,
            members: createdData.members?.map((m: any) => ({
              id: String(m.user?.id || m.id),
              name: m.user?.name || member.name,
              avatar: (m.user?.name || member.name)[0],
              role: m.membership_type || 'Member',
            })) || [
              { id: String(currentUser?.id), name: currentUser?.name || 'You', avatar: 'Y', role: 'creator' },
              { id: String(member.id), name: member.name, avatar: member.name[0], role: 'member' },
            ],
          };
          setConversations((prev) => [targetConv!, ...prev]);
          setMessagesByConversation((prev) => ({ ...prev, [targetConv!.id]: [] }));
        }
      } catch (err) {
        console.error('Failed to create direct conversation for direct call:', err);
      }
    }

    if (targetConv) {
      setActiveConversation(targetConv);
      loadMessages(targetConv.id, readCursors[targetConv.id] || 0);
    }

    // 2. Initiate Call
    const callId = `call_${Date.now()}`;
    activeCallIdRef.current = callId;
    setIsIncomingCall(false);
    setIsCallVideo(isVideo);
    setIncomingCallData(null);
    setIsVideoCallOpen(true);

    const signalData = {
      callId,
      callerId: String(currentUser?.id || 'me'),
      callerName: currentUser?.name || 'You',
      callerAvatar: (currentUser?.name || 'Y').substring(0, 2).toUpperCase(),
      receiverId: targetConv ? String(targetConv.id) : undefined,
      receiverUserId: String(member.id),
      conversationId: targetConv?.id,
      isVideo,
      e2eeFingerprint: '7F8A-92BC-44D1-0988-E2A4-71F0',
    };

    socketService.initiateCall(signalData);
    if (companySlug) {
      api.post(`/companies/${companySlug}/collaboration/calls/signal`, {
        action: 'initiate',
        signal: signalData,
      }).catch(() => {});
    }
  };

  const handleAcceptIncomingCall = (callSignal: IncomingCallSignal) => {
    activeCallIdRef.current = callSignal.callId;
    setIncomingCallData(null);
    setIsIncomingCall(true);
    setIsCallVideo(callSignal.isVideo);
    setIsVideoCallOpen(true);

    if (callSignal.conversationId) {
      const existing = conversations.find((c) => c.id === callSignal.conversationId);
      if (existing) {
        setActiveConversation(existing);
        loadMessages(existing.id, readCursors[existing.id] || 0);
      } else {
        // Auto-load conversations so caller's chat appears on recipient side
        loadConversationsAndMembers();
      }
    }

    // Pass callerId so server can route call_answered back to the correct caller
    socketService.answerCall(callSignal.callId, callSignal.callerId);
    if (companySlug) {
      api.post(`/companies/${companySlug}/collaboration/calls/signal`, {
        action: 'answer',
        call_id: callSignal.callId,
      }).catch(() => {});
    }
  };

  const handleDeclineIncomingCall = (callSignal: IncomingCallSignal) => {
    const decliningId = callSignal.callId;
    activeCallIdRef.current = null;
    setIncomingCallData(null);
    // Pass callerId so server routes call_declined back to the caller
    socketService.declineCall(decliningId, callSignal.callerId);
    if (companySlug) {
      api.post(`/companies/${companySlug}/collaboration/calls/signal`, {
        action: 'decline',
        call_id: decliningId,
      }).catch(() => {});
    }
  };

  const handleCallEnded = async (durationSeconds: number, isVideo: boolean) => {
    const endedCallId = activeCallIdRef.current;
    activeCallIdRef.current = null;
    if (endedCallId && companySlug) {
      api.post(`/companies/${companySlug}/collaboration/calls/signal`, {
        action: 'end',
        call_id: endedCallId,
      }).catch(() => {});
    }

    if (!activeConversation) return;

    const mins = Math.floor(durationSeconds / 60);
    const secs = durationSeconds % 60;
    const formattedDuration = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    const status = durationSeconds > 0 ? 'completed' : 'missed';

    const currentMaxSeq = activeMessages.reduce((max, m) => Math.max(max, m.sequenceNumber || 0), 0);
    const nextSeq = currentMaxSeq + 1;
    const tempId = `call_${Date.now()}`;

    const callLog: CallLogItem = {
      id: tempId,
      type: isVideo ? 'video' : 'audio',
      status,
      duration: durationSeconds > 0 ? formattedDuration : undefined,
      durationSeconds,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      date: new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }),
      callerName: currentUser?.name || 'You',
      receiverName: activeConversation.name,
      isMeCaller: true,
    };

    const callBody = isVideo
      ? status === 'completed'
        ? `Video call ended · ${formattedDuration}`
        : 'Missed video call'
      : status === 'completed'
      ? `Voice call ended · ${formattedDuration}`
      : 'Missed voice call';

    const callLogMessage: ChatMessage = {
      id: tempId,
      conversationId: activeConversation.id,
      sequenceNumber: nextSeq,
      senderId: String(currentUser?.id || 'sa_1'),
      senderName: currentUser?.name || 'You',
      senderAvatar: (currentUser?.name || 'Y')[0].toUpperCase(),
      body: callBody,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
      isRead: true,
      callLogDetails: callLog,
    };

    // 1. Optimistic append
    setMessagesByConversation((prev) => {
      const nextList = [...(prev[activeConversation.id] || []), callLogMessage];
      const nextMap = { ...prev, [activeConversation.id]: nextList };
      if (companySlug) {
        dataPipeline.set(`collab_messages_${companySlug}`, nextMap);
      }
      return nextMap;
    });

    setConversations((prev) => {
      const nextConvs = prev.map((c) =>
        c.id === activeConversation.id
          ? {
              ...c,
              lastMessage: callLogMessage.body,
              lastMessageTime: 'Just now',
            }
          : c
      );
      if (companySlug) {
        dataPipeline.set(`collab_conversations_${companySlug}`, nextConvs);
      }
      return nextConvs;
    });

    // 2. Broadcast via socket
    socketService.sendMessage(activeConversation.id, callLogMessage);

    // 3. Persist to MySQL Backend via API
    if (companySlug) {
      try {
        const res = await api.post(`/companies/${companySlug}/collaboration/conversations/${activeConversation.id}/messages`, {
          body: callBody,
          message_type: 'call_log',
          metadata: {
            call_log_details: callLog,
          },
        });
        const serverMsg = res.data?.data || res.data;
        if (serverMsg && serverMsg.id) {
          setMessagesByConversation((prev) => {
            const list = prev[activeConversation.id] || [];
            const nextList = list.map((m) =>
              m.id === tempId ? { ...m, id: serverMsg.id, sequenceNumber: serverMsg.sequence_number || m.sequenceNumber } : m
            );
            const nextMap = { ...prev, [activeConversation.id]: nextList };
            dataPipeline.set(`collab_messages_${companySlug}`, nextMap);
            return nextMap;
          });
        }
      } catch (err) {
        console.error('Failed to persist call log message:', err);
      }
    }
  };

  const handleScheduleMeeting = async (meeting: MeetingItem) => {
    if (!activeConversation) return;

    const currentMaxSeq = activeMessages.reduce((max, m) => Math.max(max, m.sequenceNumber || 0), 0);
    const nextSeq = currentMaxSeq + 1;
    const tempId = `meeting_${Date.now()}`;
    const meetingBody = `Scheduled Encrypted Video Sync: "${meeting.title}"`;

    const meetingMessage: ChatMessage = {
      id: tempId,
      conversationId: activeConversation.id,
      sequenceNumber: nextSeq,
      senderId: String(currentUser?.id || 'sa_1'),
      senderName: currentUser?.name || 'You',
      senderAvatar: (currentUser?.name || 'Y')[0].toUpperCase(),
      body: meetingBody,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true,
      isRead: true,
      isPinned: true,
      meetingDetails: meeting,
    };

    // 1. Optimistic append
    setMessagesByConversation((prev) => {
      const nextList = [...(prev[activeConversation.id] || []), meetingMessage];
      const nextMap = { ...prev, [activeConversation.id]: nextList };
      if (companySlug) {
        dataPipeline.set(`collab_messages_${companySlug}`, nextMap);
      }
      return nextMap;
    });

    setConversations((prev) => {
      const nextConvs = prev.map((c) =>
        c.id === activeConversation.id
          ? {
              ...c,
              lastMessage: `Meeting scheduled: ${meeting.title}`,
              lastMessageTime: 'Just now',
            }
          : c
      );
      if (companySlug) {
        dataPipeline.set(`collab_conversations_${companySlug}`, nextConvs);
      }
      return nextConvs;
    });

    // 2. Broadcast via socket
    socketService.sendMessage(activeConversation.id, meetingMessage);

    // 3. Persist to MySQL Backend via API
    if (companySlug) {
      try {
        const res = await api.post(`/companies/${companySlug}/collaboration/conversations/${activeConversation.id}/messages`, {
          body: meetingBody,
          message_type: 'meeting',
          metadata: {
            meeting_details: meeting,
          },
        });
        const serverMsg = res.data?.data || res.data;
        if (serverMsg && serverMsg.id) {
          setMessagesByConversation((prev) => {
            const list = prev[activeConversation.id] || [];
            const nextList = list.map((m) =>
              m.id === tempId ? { ...m, id: serverMsg.id, sequenceNumber: serverMsg.sequence_number || m.sequenceNumber } : m
            );
            const nextMap = { ...prev, [activeConversation.id]: nextList };
            dataPipeline.set(`collab_messages_${companySlug}`, nextMap);
            return nextMap;
          });
        }
      } catch (err) {
        console.error('Failed to persist meeting message:', err);
      }
    }
  };

  const handleUpdateConversation = async (updated: { name: string; description?: string }) => {
    if (!activeConversation || !companySlug) return;
    try {
      await api.patch(`/companies/${companySlug}/collaboration/conversations/${activeConversation.id}`, {
        title: updated.name,
      });

      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? { ...c, name: updated.name, description: updated.description }
            : c
        )
      );

      setActiveConversation((prev) =>
        prev ? { ...prev, name: updated.name, description: updated.description } : null
      );
    } catch (err) {
      console.error('Failed to update conversation:', err);
    }
  };

  const handleCreateNewConversation = async (
    newConv: Partial<Conversation>,
    recipientUserId?: number,
    memberUserIds?: number[]
  ) => {
    if (!companySlug) return;

    try {
      // Call backend API to create real conversation
      const payload: any = {
        type: newConv.type || 'direct',
        title: newConv.name,
      };

      if (newConv.type === 'direct' && recipientUserId) {
        payload.recipient_user_id = recipientUserId;
      } else if (memberUserIds && memberUserIds.length > 0) {
        payload.member_user_ids = memberUserIds;
      }

      const res = await api.post(`/companies/${companySlug}/collaboration/conversations`, payload);
      const createdData = res.data?.conversation || res.data;

      // If conversation already exists in state, activate it directly without duplicating
      const existingConv = conversations.find((c) => c.id === createdData.id);
      if (existingConv) {
        setActiveConversation(existingConv);
        loadMessages(existingConv.id, readCursors[existingConv.id] || 0);
        return;
      }

      const created: Conversation = {
        id: createdData.id || Date.now(),
        name: createdData.title || newConv.name || 'Conversation',
        type: createdData.type || newConv.type || 'direct',
        avatar: (createdData.title || newConv.name || 'C').substring(0, 2).toUpperCase(),
        avatarColor: 'bg-orange-50 text-[#f95716] border-orange-200',
        status: 'online',
        lastMessage: '',
        lastMessageTime: '',
        unreadCount: 0,
        lastSequenceNumber: 0,
        lastReadSequence: 0,
        members: createdData.members?.map((m: any) => ({
          id: String(m.user?.id || m.id),
          name: m.user?.name || 'Member',
          avatar: (m.user?.name || 'M')[0],
          role: m.membership_type || 'Member',
        })) || [],
      };

      setConversations((prev) => [created, ...prev]);
      setActiveConversation(created);
      setMessagesByConversation((prev) => ({ ...prev, [created.id]: [] }));
    } catch (err: any) {
      console.error('Failed to create conversation:', err);
      // Fallback local creation if network error
      const localCreated: Conversation = {
        id: Date.now(),
        name: newConv.name || 'New Conversation',
        type: newConv.type || 'direct',
        avatar: (newConv.name || 'NC').substring(0, 2).toUpperCase(),
        avatarColor: 'bg-orange-50 text-[#f95716] border-orange-200',
        status: 'online',
        lastMessage: '',
        lastMessageTime: '',
        unreadCount: 0,
        lastSequenceNumber: 0,
        lastReadSequence: 0,
        members: [],
      };
      setConversations((prev) => [localCreated, ...prev]);
      setActiveConversation(localCreated);
      setMessagesByConversation((prev) => ({ ...prev, [localCreated.id]: [] }));
    }
  };

  const handleStartDirectChatWithMember = async (member: any) => {
    // Check if direct conversation already exists in state
    const existing = conversations.find(
      (c) => c.type === 'direct' && c.members?.some((m) => String(m.id) === String(member.id))
    );
    if (existing) {
      handleSelectConversation(existing);
      return;
    }

    // Auto-create direct conversation with member via backend
    await handleCreateNewConversation(
      {
        name: member.name,
        type: 'direct',
      },
      Number(member.id)
    );
  };

  // Dynamic stats for right details drawer
  const pinnedList = activeMessages.filter((m) => m.isPinned);
  const totalReactions = activeMessages.reduce(
    (sum, m) => sum + (m.reactions?.reduce((acc, r) => acc + r.count, 0) || 0),
    0
  );

  const derivedCallLogs: CallLogItem[] = React.useMemo(() => {
    return activeMessages
      .filter((m) => {
        return (
          Boolean(m.callLogDetails) ||
          /((voice|video)\s*call\s*(ended|missed)|missed\s*(voice|video)?\s*call)/i.test(m.body || '') ||
          /📞|📹/.test(m.body || '')
        );
      })
      .map((m) => {
        if (m.callLogDetails) return m.callLogDetails;
        const isVideo = /video/i.test(m.body || '') || /📹/.test(m.body || '');
        const isMissed = /missed/i.test(m.body || '');
        const durationMatch = (m.body || '').match(/(\d{1,2}:\d{2})/);
        const durationStr = durationMatch ? durationMatch[1] : undefined;
        return {
          id: `call_${m.id}`,
          type: isVideo ? ('video' as const) : ('audio' as const),
          status: isMissed ? ('missed' as const) : ('completed' as const),
          duration: durationStr,
          timestamp: m.timestamp || 'Recently',
          callerName: m.isMe ? 'You' : m.senderName,
          receiverName: m.isMe ? (activeConversation?.name || 'Colleague') : 'You',
          isMeCaller: m.isMe,
        };
      })
      .reverse();
  }, [activeMessages, activeConversation?.name]);

  return (
    <AppShell title="Messages & Collaboration">
      {/* 3-Panel Responsive Layout Container */}
      <div className="w-full h-[calc(100vh-140px)] min-h-[600px] flex gap-4 overflow-hidden relative">
        {/* PANEL 1: CONVERSATIONS LIST (Left, 320-350px) */}
        <div
          className={`w-full lg:w-80 xl:w-88 shrink-0 h-full transition-all duration-200 ${
            activeMobileView === 'list' ? 'block' : 'hidden lg:block'
          }`}
        >
          <ConversationListPanel
            conversations={conversations}
            activeConversationId={activeConversation?.id || 0}
            onSelectConversation={handleSelectConversation}
            onNewConversation={() => setIsNewConversationOpen(true)}
            availableMembers={availableMembers}
            onStartDirectChatWithMember={handleStartDirectChatWithMember}
            onStartCallWithColleague={handleStartCallWithColleague}
            currentUserId={currentUser?.id}
          />
        </div>

        {/* PANEL 2: ACTIVE CHAT CANVAS (Center, flex-1) */}
        <div
          className={`flex-1 h-full min-w-0 transition-all duration-200 ${
            activeMobileView === 'chat' ? 'block' : 'hidden lg:block'
          }`}
        >
          {activeConversation ? (
            <>
              {/* Mobile Back / Details Switcher */}
              <div className="lg:hidden flex items-center justify-between gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setActiveMobileView('list')}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>All Messages</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMobileView('details')}
                  className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs"
                >
                  <span>Channel Details</span>
                </button>
              </div>

              <ActiveChatPanel
                conversation={activeConversation}
                messages={activeMessages}
                onSendMessage={handleSendMessage}
                onEditMessage={handleEditMessage}
                onDeleteMessage={handleDeleteMessage}
                onBulkDeleteMessages={handleBulkDeleteMessages}
                onStartCall={handleStartCall}
                onArrangeMeeting={() => setIsArrangeMeetingOpen(true)}
                onToggleDetails={() => setIsDetailsOpen((prev) => !prev)}
                onToggleReaction={handleToggleReaction}
                onTogglePin={handleTogglePin}
                onJoinMeeting={() => {
                  setIsCallVideo(true);
                  setIsVideoCallOpen(true);
                }}
                isDetailsOpen={isDetailsOpen}
                isTyping={isPeerTyping}
              />
            </>
          ) : (
            // Clean Empty State when no conversation is selected
            <div className="w-full h-full bg-white rounded-3xl border border-slate-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-[#f95716] shadow-xs">
                <MessageSquare className="w-8 h-8 stroke-[2.2]" />
              </div>
              <div className="max-w-md space-y-1">
                <h3 className="text-base font-black text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
                  No Conversation Selected
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Select a discussion channel from the left panel or start a new direct message with a team member.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewConversationOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#e85a1a] via-[#f36b24] to-[#fa8136] text-white text-xs font-bold shadow-xs hover:opacity-95 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Start New Conversation</span>
              </button>
            </div>
          )}
        </div>

        {/* PANEL 3: CONVERSATION DETAILS DRAWER (Right, 320-340px) */}
        {isDetailsOpen && activeConversation && (
          <div
            className={`w-full lg:w-80 xl:w-84 shrink-0 h-full transition-all duration-200 animate-in fade-in duration-150 ${
              activeMobileView === 'details' ? 'block' : 'hidden xl:block'
            }`}
          >
            {/* Mobile Back Button to chat */}
            <div className="xl:hidden flex items-center mb-2">
              <button
                type="button"
                onClick={() => setActiveMobileView('chat')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 shadow-2xs"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back to Conversation</span>
              </button>
            </div>

            <ConversationDetailsPanel
              conversation={activeConversation}
              pinnedMessages={pinnedList}
              totalMessagesCount={activeMessages.length}
              totalReactionsCount={totalReactions}
              callLogs={derivedCallLogs}
              onStartCall={handleStartCall}
              onClose={() => {
                setIsDetailsOpen(false);
                if (activeMobileView === 'details') setActiveMobileView('chat');
              }}
              onUpdateConversation={handleUpdateConversation}
            />
          </div>
        )}
      </div>

      {/* INCOMING CALL MODAL (RINGS AUTOMATICALLY FOR RECIPIENT) */}
      <IncomingCallModal
        call={incomingCallData}
        onAccept={handleAcceptIncomingCall}
        onDecline={handleDeclineIncomingCall}
      />

      {/* MODAL 1: ADVANCED ENCRYPTED VIDEO & AUDIO CALL OVERLAY (THEME ALIGNED) */}
      {isVideoCallOpen && (
        <VideoCallModal
          isOpen={isVideoCallOpen}
          callId={activeCallIdRef.current || incomingCallData?.callId || undefined}
          onClose={() => {
            const closingCallId = activeCallIdRef.current;
            activeCallIdRef.current = null;
            if (closingCallId && companySlug) {
              api.post(`/companies/${companySlug}/collaboration/calls/signal`, {
                action: 'end',
                call_id: closingCallId,
              }).catch(() => {});
            }
            setIsVideoCallOpen(false);
            setIncomingCallData(null);
            setIsIncomingCall(false);
          }}
          participantName={incomingCallData?.callerName || activeConversation?.name || 'Team Member'}
          participantAvatar={
            incomingCallData?.callerName
              ? incomingCallData.callerName.substring(0, 2).toUpperCase()
              : activeConversation?.avatar || 'TM'
          }
          isVideoCall={isCallVideo}
          isIncomingCall={isIncomingCall}
          onCallEnded={handleCallEnded}
        />
      )}

      {/* MODAL 2: ARRANGE VIDEO MEETING MODAL */}
      {activeConversation && (
        <ArrangeMeetingModal
          isOpen={isArrangeMeetingOpen}
          onClose={() => setIsArrangeMeetingOpen(false)}
          onScheduleMeeting={handleScheduleMeeting}
          onStartInstantMeeting={() => {
            setIsCallVideo(true);
            setIsVideoCallOpen(true);
          }}
          defaultParticipant={activeConversation.name}
          companySlug={companySlug}
        />
      )}

      {/* MODAL 3: NEW CONVERSATION MODAL (WITH REAL WORKSPACE MEMBERS) */}
      <NewConversationModal
        isOpen={isNewConversationOpen}
        onClose={() => setIsNewConversationOpen(false)}
        onCreate={handleCreateNewConversation}
        availableMembers={availableMembers}
        currentUserId={currentUser?.id}
      />
    </AppShell>
  );
};

export default CollaborationPage;
