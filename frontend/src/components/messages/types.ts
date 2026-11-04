export interface Conversation {
  id: number;
  name: string;
  role?: string;
  description?: string;
  type: 'direct' | 'project' | 'group';
  avatar: string;
  avatarColor: string;
  status: 'online' | 'offline' | 'away';
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  lastSequenceNumber?: number;
  lastReadSequence?: number;
  members: Array<{
    id: string;
    name: string;
    avatar: string;
    role?: string;
    email?: string;
    status?: 'online' | 'offline' | 'away';
    lastSeenHuman?: string;
  }>;
  isPinned?: boolean;
  onlineMembersCount?: number;
  totalMembersCount?: number;
  lastSeenAt?: string;
  lastSeenHuman?: string;
}

export interface UserPresence {
  userId: string | number;
  status: 'online' | 'offline' | 'away';
  isOnline: boolean;
  lastSeenAt?: string | null;
  lastSeenHuman?: string;
}

export interface ChatMessage {
  id: number | string;
  conversationId: number;
  sequenceNumber: number;
  senderId: string;
  senderName: string;
  senderAvatar: string;
  senderColor?: string;
  body: string;
  timestamp: string;
  isMe: boolean;
  isRead?: boolean;
  isPinned?: boolean;
  isDeleted?: boolean;
  isEdited?: boolean;
  replyTo?: { id: string | number; sender: string; text: string };
  reactions?: Array<{ emoji: string; count: number; userReacted?: boolean }>;
  attachments?: Array<{ name: string; size: string; type: string; url?: string }>;
  meetingDetails?: MeetingItem;
  callLogDetails?: CallLogItem;
}

export interface CallLogItem {
  id: string;
  type: 'audio' | 'video';
  status: 'completed' | 'missed' | 'declined';
  duration?: string;
  durationSeconds?: number;
  timestamp: string;
  date?: string;
  callerName: string;
  receiverName: string;
  isMeCaller?: boolean;
}

export interface MeetingItem {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  link: string;
  participants: string[];
  encryptionType: string;
}

export interface SharedFileItem {
  id: string;
  name: string;
  size: string;
  date: string;
  extension: 'pdf' | 'xlsx' | 'docx' | 'png' | 'zip';
  uploader: string;
}
