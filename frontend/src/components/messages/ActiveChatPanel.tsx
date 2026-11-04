import React, { useState, useRef, useEffect } from 'react';
import {
  Phone,
  PhoneMissed,
  Video,
  VideoOff,
  Calendar,
  Search,
  MoreVertical,
  Paperclip,
  Smile,
  Send,
  Pin,
  Reply,
  Trash2,
  ThumbsUp,
  Heart,
  Flame,
  Check,
  CheckCheck,
  SidebarOpen,
  SidebarClose,
  Lock,
  Sparkles,
  Link2,
  ExternalLink,
  ShieldCheck,
  Copy,
  MessageSquare,
  X,
  Plus,
  Pencil,
  CheckSquare,
  Lightbulb,
} from 'lucide-react';
import { Conversation, ChatMessage, MeetingItem } from './types';
import { ReactionIcon, REACTION_DEFINITIONS, QUICK_REACTIONS } from './ReactionIcon';
import { useConfirm } from '../../context/ConfirmationModalContext';

interface ActiveChatPanelProps {
  conversation: Conversation;
  messages: ChatMessage[];
  onSendMessage: (text: string, replyToId?: number | string) => void;
  onEditMessage?: (messageId: number | string, newText: string) => void;
  onDeleteMessage?: (messageId: number | string) => void;
  onBulkDeleteMessages?: (messageIds: (number | string)[]) => void;
  onStartCall: (isVideo: boolean) => void;
  onArrangeMeeting: () => void;
  onToggleDetails: () => void;
  onToggleReaction: (messageId: number | string, emoji: string) => void;
  onTogglePin: (messageId: number | string) => void;
  onJoinMeeting?: (meeting: MeetingItem) => void;
  isDetailsOpen: boolean;
  isTyping?: boolean;
}

export const ActiveChatPanel: React.FC<ActiveChatPanelProps> = ({
  conversation,
  messages,
  onSendMessage,
  onEditMessage,
  onDeleteMessage,
  onBulkDeleteMessages,
  onStartCall,
  onArrangeMeeting,
  onToggleDetails,
  onToggleReaction,
  onTogglePin,
  onJoinMeeting,
  isDetailsOpen,
  isTyping = false,
}) => {
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<number | string | null>(null);
  const [activeEmojiPickerMsgId, setActiveEmojiPickerMsgId] = useState<number | string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<number | string | null>(null);
  const [editText, setEditText] = useState('');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<(number | string)[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const { confirm } = useConfirm();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onSendMessage(`Shared file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleSelectMessage = (msgId: number | string) => {
    setSelectedIds((prev) =>
      prev.includes(msgId) ? prev.filter((id) => id !== msgId) : [...prev, msgId]
    );
  };

  const handleSaveEdit = (messageId: number | string) => {
    if (!editText.trim()) return;
    onEditMessage?.(messageId, editText.trim());
    setEditingMessageId(null);
    setEditText('');
  };

  const handleDoubleClickMessage = (msg: ChatMessage) => {
    if (msg.isDeleted) return;
    setReplyingTo(msg);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText, replyingTo?.id);
    setInputText('');
    setReplyingTo(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyMeetingLink = (link: string) => {
    navigator.clipboard?.writeText(link);
    setCopiedLink(link);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  return (
    <div className="w-full h-full bg-white rounded-3xl border border-slate-100/90 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col overflow-hidden">
      {/* 1. Chat Header */}
      <div className="p-3.5 sm:p-4 border-b border-slate-100 flex items-center justify-between z-10 bg-white/95 backdrop-blur-xs">
        {/* Left: Avatar & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            <div
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs uppercase shadow-2xs border ${conversation.avatarColor}`}
            >
              {conversation.avatar}
            </div>
            {conversation.type === 'direct' && (
              conversation.status === 'online' ? (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white ring-1 ring-emerald-500/20 shadow-2xs" title="Online" />
              ) : conversation.status === 'away' ? (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-white ring-1 ring-amber-400/20 shadow-2xs" title="Away" />
              ) : (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-slate-300 rounded-full border-2 border-white" title={conversation.lastSeenHuman || 'Offline'} />
              )
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs sm:text-sm font-bold text-slate-900 truncate font-['Plus_Jakarta_Sans',sans-serif]">
                {conversation.name}
              </h2>
            </div>
            <p className="text-[11px] text-slate-400 font-medium truncate flex items-center gap-1.5">
              <span>{conversation.type === 'direct' ? 'Direct Message' : 'Team Channel'}</span>
              <span>·</span>
              {conversation.type === 'direct' ? (
                conversation.status === 'online' ? (
                  <span className="text-emerald-600 font-bold inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </span>
                ) : conversation.status === 'away' ? (
                  <span className="text-amber-600 font-semibold inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Away
                  </span>
                ) : (
                  <span className="text-slate-400 font-normal inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                    {conversation.lastSeenHuman || 'Offline'}
                  </span>
                )
              ) : (
                <span className="text-slate-500 font-medium inline-flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${conversation.onlineMembersCount ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                  {conversation.onlineMembersCount !== undefined && conversation.onlineMembersCount > 0
                    ? `${conversation.onlineMembersCount} of ${conversation.totalMembersCount || conversation.members?.length || 1} online`
                    : `${conversation.members?.length || 0} members`}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right Action Icons */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Voice Audio Call */}
          <button
            type="button"
            onClick={() => onStartCall(false)}
            className="w-8 h-8 rounded-xl hover:bg-orange-50 text-slate-600 hover:text-[#f95716] flex items-center justify-center transition-colors cursor-pointer"
            title="Start Encrypted Voice Call"
          >
            <Phone className="w-4 h-4" />
          </button>

          {/* Video Call */}
          <button
            type="button"
            onClick={() => onStartCall(true)}
            className="w-8 h-8 rounded-xl hover:bg-orange-50 text-slate-600 hover:text-[#f95716] flex items-center justify-center transition-colors cursor-pointer"
            title="Start Encrypted Video Call"
          >
            <Video className="w-4 h-4" />
          </button>

          {/* Arrange Meeting */}
          <button
            type="button"
            onClick={onArrangeMeeting}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#e85a1a] to-[#fa8136] hover:opacity-95 text-white text-xs font-bold shadow-[0_3px_10px_rgba(249,87,22,0.22)] transition-all cursor-pointer active:scale-95"
            title="Schedule Video Meeting"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Meet</span>
          </button>

          {/* Bulk Select / Manage Messages Toggle (Visible on all screens) */}
          <button
            type="button"
            onClick={() => {
              setIsSelectionMode((prev) => !prev);
              setSelectedIds([]);
            }}
            className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              isSelectionMode
                ? 'bg-orange-500/10 text-[#f95716] border border-orange-500/25 ring-1 ring-orange-400/20 shadow-2xs'
                : 'hover:bg-slate-100 text-slate-600'
            }`}
            title={isSelectionMode ? 'Cancel bulk selection' : 'Select messages to bulk delete'}
          >
            <CheckSquare className="w-3.5 h-3.5 text-[#f95716]" />
            <span className="hidden sm:inline">{isSelectionMode ? 'Done' : 'Select'}</span>
          </button>

          {/* Toggle Details Panel */}
          <button
            type="button"
            onClick={onToggleDetails}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
              isDetailsOpen ? 'bg-orange-50 text-[#f95716]' : 'hover:bg-slate-100 text-slate-500'
            }`}
            title="Toggle Details Drawer"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Messages Canvas */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-5 space-y-4 bg-[radial-gradient(ellipse_at_top,_rgba(249,87,22,0.06),_transparent_75%)]">
        {/* Floating Bulk Action Bar (Responsive across all screens) */}
        {isSelectionMode && (
          <div className="sticky top-0 z-30 mx-auto w-full max-w-lg bg-white/95 backdrop-blur-md rounded-2xl border border-orange-200/90 shadow-[0_8px_30px_rgba(249,87,22,0.12)] p-2.5 sm:p-3 flex items-center justify-between gap-2 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold text-xs shadow-2xs shrink-0">
                {selectedIds.length}
              </span>
              <div className="min-w-0 truncate">
                <span className="text-xs font-bold text-slate-800 block truncate">
                  {selectedIds.length === 0
                    ? 'Tap messages to select'
                    : selectedIds.length === 1
                    ? '1 message selected'
                    : `${selectedIds.length} messages selected`}
                </span>
                <span className="text-[10px] text-slate-400 font-medium hidden sm:block">
                  Click any message or checkbox
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const myMsgIds = messages.filter((m) => m.isMe).map((m) => m.id);
                  if (selectedIds.length === myMsgIds.length && myMsgIds.length > 0) {
                    setSelectedIds([]);
                  } else {
                    setSelectedIds(myMsgIds);
                  }
                }}
                className="text-[11px] font-bold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200/80"
              >
                {selectedIds.length > 0 && selectedIds.length === messages.filter((m) => m.isMe).length
                  ? 'Deselect All'
                  : 'Select All'}
              </button>

              <button
                type="button"
                disabled={selectedIds.length === 0}
                onClick={async () => {
                  if (selectedIds.length === 0) return;
                  const ok = await confirm({
                    title: 'Delete Selected Messages',
                    message: `Are you sure you want to permanently delete ${selectedIds.length} selected message(s)? This action cannot be undone.`,
                    confirmText: 'Delete Messages',
                    variant: 'danger',
                  });
                  if (ok) {
                    onBulkDeleteMessages?.(selectedIds);
                    setSelectedIds([]);
                    setIsSelectionMode(false);
                  }
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsSelectionMode(false);
                  setSelectedIds([]);
                }}
                className="w-7 h-7 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer ml-0.5"
                title="Cancel selection"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        {messages.length === 0 ? (
          <div className="h-full min-h-[360px] flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-14 h-14 rounded-3xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-[#f95716] shadow-xs">
              <MessageSquare className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="max-w-sm space-y-1">
              <h3 className="text-sm font-black text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
                No messages yet in {conversation.name}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Send the first message below to start collaborating. All messages in this channel are synced in real-time.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Load older messages button */}
            <div className="flex justify-center">
              <button
                type="button"
                className="px-3.5 py-1 rounded-full bg-white border border-slate-200/80 text-[11px] font-bold text-slate-500 hover:text-[#f95716] shadow-2xs hover:shadow-xs transition-all cursor-pointer"
              >
                Load older messages ↑
              </button>
            </div>

            {/* Date Divider */}
            <div className="flex items-center justify-center">
              <span className="px-3 py-0.5 rounded-full bg-slate-100/90 text-slate-500 text-[10.5px] font-semibold">
                Today
              </span>
            </div>

            {/* Messages Stream */}
            {messages.map((msg, index) => {
              const isSender = msg.isMe;
              const isSelected = selectedIds.includes(msg.id);
              const isCallMessage = !!msg.callLogDetails || /((voice|video)\s*call\s*(ended|missed)|missed\s*(voice|video)?\s*call)/i.test(msg.body || '') || /📞|📹/.test(msg.body || '');
              const callInfo = isCallMessage ? (msg.callLogDetails || {
                type: (/video/i.test(msg.body || '') ? 'video' : 'audio') as 'audio' | 'video',
                status: (/missed/i.test(msg.body || '') ? 'missed' : 'completed') as 'completed' | 'missed',
                duration: (msg.body || '').match(/\d{1,2}:\d{2}/)?.[0] || '00:00',
              }) : null;

              return (
                <div
                  key={`${msg.id}_${index}`}
                  onClick={() => {
                    if (isSelectionMode && isSender) {
                      toggleSelectMessage(msg.id);
                    }
                  }}
                  className={`group relative flex items-end gap-2 p-1 rounded-2xl transition-all duration-150 ${
                    isSender ? 'justify-end' : 'justify-start'
                  } ${
                    isSelectionMode && isSender
                      ? isSelected
                        ? 'bg-orange-500/10 ring-2 ring-[#f95716]/60 cursor-pointer shadow-xs'
                        : 'hover:bg-slate-100/70 cursor-pointer'
                      : ''
                  }`}
                >
                  {/* Custom Selection Checkbox for bulk actions (Branded Finovo UX) */}
                  {isSelectionMode && isSender && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelectMessage(msg.id);
                      }}
                      className={`w-5 h-5 rounded-lg flex items-center justify-center transition-all duration-150 cursor-pointer shrink-0 self-center mr-1 shadow-2xs ${
                        isSelected
                          ? 'bg-[#f95716] text-white ring-2 ring-orange-200 scale-105'
                          : 'border-2 border-slate-300 bg-white hover:border-[#f95716] hover:bg-orange-50/50'
                      }`}
                      title={isSelected ? 'Deselect message' : 'Select message'}
                      aria-label="Select message"
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3] text-white" />}
                    </button>
                  )}

                  {/* Receiver Avatar */}
                  {!isSender && (
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-[10.5px] font-bold uppercase shrink-0 shadow-2xs border ${
                        msg.senderColor || 'bg-orange-50 text-[#f95716] border-orange-200'
                      }`}
                    >
                      {msg.senderAvatar}
                    </div>
                  )}

                  {/* Message Bubble Block */}
                  <div
                    className={`max-w-[85%] sm:max-w-[70%] space-y-1 ${
                      isSender ? 'items-end' : 'items-start'
                    }`}
                  >
                    {/* Sender Name & Time */}
                    <div
                      className={`flex items-center gap-1.5 text-[10.5px] text-slate-400 font-medium px-1 ${
                        isSender ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <span className="font-bold text-slate-700">{msg.senderName}</span>
                      <span>{msg.timestamp}</span>
                      {msg.isPinned && (
                        <span className="flex items-center gap-0.5 text-[#f95716] font-bold">
                          <Pin className="w-2.5 h-2.5" />
                          Pinned
                        </span>
                      )}
                      {isSender && (
                        <span
                          className="flex items-center gap-0.5 ml-0.5 transition-colors select-none"
                          title={msg.isRead ? 'Read by recipient' : 'Delivered to server'}
                        >
                          {msg.isRead ? (
                            <CheckCheck className="w-3.5 h-3.5 text-[#f95716] stroke-[2.3]" />
                          ) : (
                            <Check className="w-3.5 h-3.5 text-slate-400 stroke-[2.2]" />
                          )}
                        </span>
                      )}
                    </div>

                {/* Bubble Container */}
                <div
                  onDoubleClick={() => handleDoubleClickMessage(msg)}
                  title="Double-click to reply"
                  className={`group/bubble relative rounded-2xl text-xs transition-all shadow-xs cursor-pointer select-text ${
                    replyingTo?.id === msg.id ? 'ring-2 ring-[#f95716]/60 shadow-md ' : ''
                  }${
                    callInfo
                      ? 'p-1.5 bg-white/95 text-slate-900 border border-orange-200/80'
                      : isSender
                      ? 'p-3.5 bg-gradient-to-br from-[#fff7ed] to-[#ffedd5]/60 text-slate-900 border border-orange-200/70 rounded-br-xs hover:border-orange-300'
                      : 'p-3.5 bg-white text-slate-900 border border-slate-100/90 rounded-bl-xs hover:border-slate-200'
                  }`}
                >
                  {/* Reply preview if replying */}
                  {msg.replyTo && (
                    <div className="p-2 mb-2 rounded-xl bg-slate-50/90 border border-slate-200/60 text-[11px] space-y-0.5">
                      <span className="font-bold text-[#f95716] block">{msg.replyTo.sender}</span>
                      <p className="text-slate-500 line-clamp-1 italic">{msg.replyTo.text}</p>
                    </div>
                  )}

                  {/* Body Text / Inline Edit Form */}
                  {editingMessageId === msg.id ? (
                    <div className="space-y-2 py-1 min-w-[240px]" onClick={(e) => e.stopPropagation()}>
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSaveEdit(msg.id);
                          } else if (e.key === 'Escape') {
                            setEditingMessageId(null);
                          }
                        }}
                        rows={2}
                        autoFocus
                        className="w-full p-2.5 bg-white rounded-xl border border-orange-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#f95716]/20 font-medium resize-none shadow-2xs leading-relaxed"
                      />
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 text-[10px]">Enter to save · Esc to cancel</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingMessageId(null)}
                            className="px-2.5 py-1 rounded-lg text-slate-500 hover:bg-slate-100 font-semibold cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(msg.id)}
                            disabled={!editText.trim()}
                            className="px-3 py-1 rounded-lg bg-[#f95716] hover:bg-[#ea580c] text-white font-bold disabled:opacity-50 cursor-pointer shadow-2xs transition-all"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : msg.isDeleted ? (
                    <p className="italic text-slate-400 flex items-center gap-1.5">
                      <Trash2 className="w-3 h-3 text-slate-400" />
                      <span>This message was deleted.</span>
                    </p>
                  ) : callInfo ? (
                    /* Pure SVG Call Log Card - No Emojis, No duplicate text */
                    <div className="p-3 bg-white/95 rounded-2xl border border-orange-200/80 shadow-xs flex items-center justify-between gap-3 min-w-[230px] sm:min-w-[280px]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                            callInfo.status === 'completed'
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/70'
                              : 'bg-rose-50 text-rose-600 border border-rose-200/70'
                          }`}
                        >
                          {callInfo.type === 'video' ? (
                            callInfo.status === 'completed' ? (
                              <Video className="w-4 h-4 stroke-[2.2]" />
                            ) : (
                              <VideoOff className="w-4 h-4 stroke-[2.2]" />
                            )
                          ) : callInfo.status === 'completed' ? (
                            <Phone className="w-4 h-4 stroke-[2.2]" />
                          ) : (
                            <PhoneMissed className="w-4 h-4 stroke-[2.2]" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate">
                            {callInfo.type === 'video' ? 'Video Call' : 'Voice Call'}
                          </h4>
                          <p className="text-[10.5px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                            {callInfo.status === 'completed' ? (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                <span>Ended · {callInfo.duration || '00:00'}</span>
                              </>
                            ) : (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                <span className="text-rose-600 font-semibold">Missed call</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartCall(callInfo.type === 'video');
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#f95716] border border-orange-200/80 text-[11px] font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1 shrink-0 active:scale-95"
                        title={callInfo.type === 'video' ? 'Start Video Call' : 'Call Back'}
                      >
                        {callInfo.type === 'video' ? (
                          <Video className="w-3 h-3" />
                        ) : (
                          <Phone className="w-3 h-3" />
                        )}
                        <span>Call back</span>
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="leading-relaxed whitespace-pre-wrap">
                        {msg.body.replace(/^[📞📹📎📅]\s*/, '')}
                      </p>
                      {msg.isEdited && (
                        <span className="text-[10px] text-slate-400 italic font-normal inline-block ml-1">
                          (edited)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Rich Meeting Card if attached */}
                  {msg.meetingDetails && (
                    <div className="mt-3 p-3.5 bg-white rounded-2xl border border-orange-200/70 shadow-xs space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-orange-500/10 flex items-center justify-center text-[#f95716]">
                            <Video className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-slate-900">
                              {msg.meetingDetails.title}
                            </h4>
                            <span className="text-[10px] text-slate-400">
                              {msg.meetingDetails.date} at {msg.meetingDetails.time} ({msg.meetingDetails.duration})
                            </span>
                          </div>
                        </div>
                        <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                          Verified Sync
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => copyMeetingLink(msg.meetingDetails!.link)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{copiedLink === msg.meetingDetails.link ? 'Link Copied!' : 'Copy Link'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onJoinMeeting?.(msg.meetingDetails!)}
                          className="px-3 py-1.5 rounded-xl bg-[#f95716] hover:bg-[#ea580c] text-white text-[11px] font-bold shadow-xs cursor-pointer"
                        >
                          Join Video Room
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Reactions Cluster Display (Attached under message bubble, matching sender/receiver alignment) */}
                {msg.reactions && msg.reactions.length > 0 && (
                  <div
                    className={`flex flex-wrap items-center gap-1.5 pt-1 px-1 ${
                      isSender ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {msg.reactions.map((r, i) => {
                      const hasReacted = !!r.userReacted;
                      return (
                        <button
                          key={`${r.emoji}-${i}`}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleReaction(msg.id, r.emoji);
                          }}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-all duration-150 cursor-pointer select-none active:scale-95 shadow-2xs ${
                            hasReacted
                              ? 'bg-orange-50 border border-orange-300 text-[#f95716] font-bold shadow-xs ring-1 ring-orange-200/60 hover:bg-orange-100'
                              : 'bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 hover:border-orange-200 font-semibold'
                          }`}
                          title={`${r.count} ${r.emoji} reaction${r.count > 1 ? 's' : ''} (Click to toggle)`}
                        >
                          <span className="flex items-center justify-center transition-transform duration-150 group-hover:scale-125">
                            <ReactionIcon name={r.emoji} className="w-3.5 h-3.5" />
                          </span>
                          <span
                            className={`text-[10.5px] leading-none font-bold font-['Plus_Jakarta_Sans',sans-serif] ${
                              hasReacted ? 'text-[#f95716]' : 'text-slate-600'
                            }`}
                          >
                            {r.count}
                          </span>
                        </button>
                      );
                    })}

                    {/* Quick '+' pill to add another reaction */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveEmojiPickerMsgId((prev) => (prev === msg.id ? null : msg.id));
                      }}
                      className="h-6 px-2 rounded-full border border-dashed border-slate-300 hover:border-[#f95716] text-slate-400 hover:text-[#f95716] hover:bg-orange-50/60 flex items-center justify-center gap-1 transition-all cursor-pointer text-[10.5px] font-semibold bg-white/80 shadow-2xs"
                      title="Add reaction"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              {/* Message Hover Actions Bar (Responsive on all screens) */}
              <div
                className={`opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all duration-150 absolute -top-4 ${
                  isSender ? 'right-2 sm:right-6' : 'left-2 sm:left-6'
                } flex items-center bg-white/95 backdrop-blur-md rounded-full shadow-[0_4px_18px_rgba(0,0,0,0.1),0_1px_3px_rgba(0,0,0,0.06)] border border-slate-200/90 px-1 py-0.5 z-20 pointer-events-auto`}
              >
                {/* Quick reaction SVGs */}
                {QUICK_REACTIONS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleReaction(msg.id, item.id);
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-orange-50 hover:scale-125 transition-all active:scale-95 cursor-pointer"
                    title={`React ${item.label}`}
                  >
                    <ReactionIcon name={item.id} className="w-3.5 h-3.5" />
                  </button>
                ))}

                {/* More emoji reactions dropdown toggle */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveEmojiPickerMsgId((prev) => (prev === msg.id ? null : msg.id));
                  }}
                  className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors cursor-pointer ${
                    activeEmojiPickerMsgId === msg.id
                      ? 'bg-orange-100 text-[#f95716]'
                      : 'text-slate-400 hover:text-[#f95716] hover:bg-orange-50'
                  }`}
                  title="More reactions"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>

                <div className="h-3.5 w-px bg-slate-200 mx-0.5" />

                {/* Quick Reply Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDoubleClickMessage(msg);
                  }}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-slate-500 hover:text-[#f95716] hover:bg-orange-50 transition-colors cursor-pointer"
                  title="Reply (or double-click message)"
                >
                  <Reply className="w-3.5 h-3.5" />
                </button>

                {/* Pin message button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin(msg.id);
                  }}
                  className={`w-7 h-7 flex items-center justify-center rounded-full transition-colors cursor-pointer ${
                    msg.isPinned
                      ? 'text-[#f95716] hover:bg-orange-50'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title={msg.isPinned ? 'Unpin message' : 'Pin message'}
                >
                  <Pin className="w-3.5 h-3.5" />
                </button>

                {/* Edit Message Button (only for sender & active messages) */}
                {isSender && !msg.isDeleted && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingMessageId(msg.id);
                      setEditText(msg.body);
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-slate-500 hover:text-[#f95716] hover:bg-orange-50 transition-colors cursor-pointer"
                    title="Edit message"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Delete Message Button (for sender) */}
                {isSender && (
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const ok = await confirm({
                        title: 'Delete Message',
                        message: 'Are you sure you want to delete this message for everyone? This action cannot be undone.',
                        confirmText: 'Delete Message',
                        variant: 'danger',
                      });
                      if (ok) {
                        onDeleteMessage?.(msg.id);
                      }
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Delete message"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Extended Emoji Reaction Picker Dropdown with Backdrop Dismiss */}
              {activeEmojiPickerMsgId === msg.id && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveEmojiPickerMsgId(null);
                    }}
                  />
                  <div
                    className={`absolute bottom-full mb-2 ${
                      isSender ? 'right-0 sm:right-4' : 'left-0 sm:left-4'
                    } bg-white rounded-2xl border border-orange-200/90 shadow-2xl p-2.5 z-40 animate-in fade-in zoom-in-95 max-w-[280px] sm:max-w-none`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 px-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Reactions
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveEmojiPickerMsgId(null)}
                        className="w-5 h-5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center cursor-pointer"
                        title="Close"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="grid grid-cols-6 sm:flex sm:items-center gap-1">
                      {REACTION_DEFINITIONS.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            onToggleReaction(msg.id, item.id);
                            setActiveEmojiPickerMsgId(null);
                          }}
                          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-orange-50 hover:scale-125 transition-all active:scale-95 cursor-pointer"
                          title={`React ${item.label}`}
                        >
                          <ReactionIcon name={item.id} className="w-4 h-4" />
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Sender Avatar */}
              {isSender && (
                <div className="w-7 h-7 rounded-full bg-orange-100 text-[#f95716] border border-orange-200 flex items-center justify-center text-[10.5px] font-bold uppercase shrink-0 shadow-2xs">
                  S
                </div>
              )}
            </div>
          );
        })}

        {/* New Messages Divider */}
        <div className="flex items-center justify-center my-3">
          <div className="h-px bg-orange-200 flex-1 max-w-[120px]" />
          <span className="px-3 text-[10px] font-bold text-[#f95716] uppercase tracking-wider">
            Active Workspace Sync
          </span>
          <div className="h-px bg-orange-200 flex-1 max-w-[120px]" />
        </div>

        {/* Live Typing Indicator */}
        {isTyping && (
          <div className="flex items-center gap-2 text-xs text-slate-400 pl-2">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f95716] animate-bounce" />
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#f95716] animate-bounce"
                style={{ animationDelay: '0.15s' }}
              />
              <span
                className="w-1.5 h-1.5 rounded-full bg-[#f95716] animate-bounce"
                style={{ animationDelay: '0.3s' }}
              />
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              {conversation.name} is typing...
            </span>
          </div>
        )}

        </>
      )}

      <div ref={messagesEndRef} />
    </div>

      {/* 3. Reply Quote Bar (if active) */}
      {replyingTo && (
        <div className="px-4 py-2.5 bg-gradient-to-r from-orange-50/95 via-amber-50/70 to-orange-50/95 border-t border-orange-200/70 flex items-center justify-between text-xs animate-in slide-in-from-bottom-2 duration-150 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-xl bg-[#f95716]/10 text-[#f95716] flex items-center justify-center shrink-0 border border-orange-200/60">
              <Reply className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-500">Replying to</span>
                <span className="text-xs font-bold text-[#f95716]">{replyingTo.senderName}</span>
              </div>
              <p className="text-slate-600 text-[11px] truncate max-w-lg italic font-normal">
                "{replyingTo.body}"
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReplyingTo(null)}
            className="w-6 h-6 rounded-lg hover:bg-orange-200/60 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Cancel reply"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 4. Chat Input Bar */}
      <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-white">
        <form
          onSubmit={handleSend}
          className="relative flex items-center gap-2 bg-slate-50/90 rounded-2xl border border-slate-200/80 p-1.5 focus-within:border-[#f95716] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#f95716]/10 transition-all shadow-xs"
        >
          {/* Attachment Button */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-400 hover:text-[#f95716] hover:bg-orange-50/50 rounded-xl transition-colors cursor-pointer shrink-0"
            title="Attach file or photo"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Textarea / Input */}
          <textarea
            ref={inputRef}
            rows={1}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              conversation.type === 'direct'
                ? `Message ${conversation.name}... (Press Enter to send)`
                : `Message #${conversation.name}... (Press Enter to send, @ to mention)`
            }
            className="flex-1 bg-transparent text-xs text-slate-900 placeholder-slate-400 focus:outline-none resize-none py-1.5 font-medium leading-relaxed max-h-24"
          />

          {/* Reaction Picker Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => (prev ? null : 'input'))}
              className={`p-2 rounded-xl transition-colors cursor-pointer shrink-0 ${
                showEmojiPicker === 'input'
                  ? 'bg-orange-50 text-[#f95716]'
                  : 'text-slate-400 hover:text-[#f95716]'
              }`}
              title="Add Reaction / Sticker"
            >
              <Smile className="w-4 h-4" />
            </button>

            {showEmojiPicker === 'input' && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowEmojiPicker(null)}
                />
                <div className="absolute right-0 bottom-full mb-2 bg-white rounded-2xl border border-orange-200/90 shadow-2xl p-2 z-40 animate-in fade-in zoom-in-95 min-w-[210px]">
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1.5 flex items-center justify-between">
                    <span>Reactions</span>
                    <button
                      type="button"
                      onClick={() => setShowEmojiPicker(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {REACTION_DEFINITIONS.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (messages.length > 0) {
                            const lastMsg = messages[messages.length - 1];
                            onToggleReaction(lastMsg.id, item.id);
                          }
                          setShowEmojiPicker(null);
                        }}
                        className="w-7 h-7 flex items-center justify-center rounded-xl hover:bg-orange-50 hover:scale-115 transition-all cursor-pointer"
                        title={`React ${item.label}`}
                      >
                        <ReactionIcon name={item.id} className="w-3.5 h-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="w-9 h-9 rounded-xl bg-gradient-to-r from-[#e85a1a] via-[#f36b24] to-[#fa8136] hover:opacity-95 disabled:opacity-50 text-white flex items-center justify-center shadow-[0_3px_10px_rgba(249,87,22,0.22)] transition-all cursor-pointer active:scale-95 shrink-0"
            title="Send Message (Enter)"
          >
            <Send className="w-4 h-4 stroke-[2.2]" />
          </button>
        </form>

        {/* Footer Hint Text */}
        <p className="text-[10px] text-slate-400 mt-1.5 px-2 text-center sm:text-left flex items-center gap-1.5 justify-center sm:justify-start">
          <span>Enter to send</span>
          <span>·</span>
          <span>Shift + Enter for new line</span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <Lightbulb className="w-3 h-3 text-amber-500" />
            Double-click any message to reply
          </span>
        </p>
      </div>
    </div>
  );
};
