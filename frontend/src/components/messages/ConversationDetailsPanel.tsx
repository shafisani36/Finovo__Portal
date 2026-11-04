import React, { useState } from 'react';
import {
  X,
  Bell,
  BellOff,
  Edit2,
  FileSpreadsheet,
  FileText,
  Download,
  Pin,
  ChevronRight,
  ExternalLink,
  Users,
  ShieldCheck,
  Check,
  Phone,
  Video,
  PhoneMissed,
  PhoneCall,
  Clock,
  Info,
} from 'lucide-react';
import { Conversation, ChatMessage, SharedFileItem, CallLogItem } from './types';

interface ConversationDetailsPanelProps {
  conversation: Conversation;
  pinnedMessages: ChatMessage[];
  totalMessagesCount: number;
  totalReactionsCount: number;
  onClose: () => void;
  sharedFiles?: SharedFileItem[];
  callLogs?: CallLogItem[];
  onStartCall?: (isVideo: boolean) => void;
  onUpdateConversation?: (updated: { name: string; description?: string }) => Promise<void> | void;
}

export const ConversationDetailsPanel: React.FC<ConversationDetailsPanelProps> = ({
  conversation,
  pinnedMessages,
  totalMessagesCount,
  totalReactionsCount,
  onClose,
  sharedFiles = [],
  callLogs = [],
  onStartCall,
  onUpdateConversation,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'calls' | 'files'>('details');
  const [callFilter, setCallFilter] = useState<'all' | 'audio' | 'video' | 'missed'>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(conversation.name);
  const [editDescription, setEditDescription] = useState(conversation.description || '');
  const [isSaving, setIsSaving] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [notificationPref, setNotificationPref] = useState<'all' | 'mentions' | 'muted'>('all');
  const [notificationFeedback, setNotificationFeedback] = useState<string | null>(null);

  const handleSelectNotificationPref = (pref: 'all' | 'mentions' | 'muted') => {
    setNotificationPref(pref);
    setShowNotificationMenu(false);
    const feedbackMap = {
      all: 'All notifications enabled',
      mentions: 'Mentions only (@you) enabled',
      muted: 'Notifications muted for this conversation',
    };
    setNotificationFeedback(feedbackMap[pref]);
    setTimeout(() => setNotificationFeedback(null), 3000);
  };

  const filteredCalls = React.useMemo(() => {
    return callLogs.filter((c) => {
      if (callFilter === 'all') return true;
      if (callFilter === 'audio') return c.type === 'audio';
      if (callFilter === 'video') return c.type === 'video';
      if (callFilter === 'missed') return c.status === 'missed';
      return true;
    });
  }, [callLogs, callFilter]);

  React.useEffect(() => {
    setEditTitle(conversation.name);
    setEditDescription(conversation.description || '');
    setIsEditing(false);
  }, [conversation.id]);

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    setIsSaving(true);
    try {
      await onUpdateConversation?.({
        name: editTitle.trim(),
        description: editDescription.trim(),
      });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = (file: SharedFileItem) => {
    setDownloadingId(file.id);
    setTimeout(() => {
      // Create lightweight simulated text blob download
      const element = document.createElement('a');
      const textFile = new Blob([`Finovo Enterprise Cloud Document: ${file.name}`], {
        type: 'text/plain',
      });
      element.href = URL.createObjectURL(textFile);
      element.download = file.name;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);
      setDownloadingId(null);
    }, 600);
  };

  return (
    <div className="w-full h-full bg-white rounded-3xl border border-slate-100/90 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col overflow-hidden">
      {/* Top Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs uppercase shadow-2xs border shrink-0 ${conversation.avatarColor}`}
          >
            {conversation.avatar}
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate font-['Plus_Jakarta_Sans',sans-serif]">
              {conversation.name}
            </h3>
            {conversation.type === 'direct' ? (
              conversation.status === 'online' ? (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Active Now</span>
                </div>
              ) : conversation.status === 'away' ? (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-600 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span>Away</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  <span>{conversation.lastSeenHuman || 'Offline'}</span>
                </div>
              )
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                <span className={`w-1.5 h-1.5 rounded-full ${conversation.onlineMembersCount ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <span>
                  {conversation.onlineMembersCount !== undefined && conversation.onlineMembersCount > 0
                    ? `${conversation.onlineMembersCount} of ${conversation.totalMembersCount || conversation.members?.length || 1} online`
                    : `${conversation.members?.length || 0} members`}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 relative">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotificationMenu((prev) => !prev)}
              className={`w-7 h-7 rounded-xl flex items-center justify-center transition-colors cursor-pointer ${
                showNotificationMenu || notificationPref === 'muted'
                  ? 'bg-orange-50 text-[#f95716]'
                  : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
              }`}
              title={`Notification Settings (${notificationPref})`}
            >
              {notificationPref === 'muted' ? (
                <BellOff className="w-3.5 h-3.5 text-rose-500" />
              ) : (
                <Bell className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Notification Popover Dropdown */}
            {showNotificationMenu && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowNotificationMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-orange-200/80 p-2 z-40 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Conversation Alerts
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectNotificationPref('all')}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                      notificationPref === 'all'
                        ? 'bg-orange-500/10 text-[#f95716]'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>All Messages</span>
                    {notificationPref === 'all' && <Check className="w-3.5 h-3.5 text-[#f95716]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectNotificationPref('mentions')}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                      notificationPref === 'mentions'
                        ? 'bg-orange-500/10 text-[#f95716]'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>Mentions Only (@you)</span>
                    {notificationPref === 'mentions' && <Check className="w-3.5 h-3.5 text-[#f95716]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectNotificationPref('muted')}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                      notificationPref === 'muted'
                        ? 'bg-rose-50 text-rose-600'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>Mute Conversation</span>
                    {notificationPref === 'muted' && <Check className="w-3.5 h-3.5 text-rose-600" />}
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            title="Close Drawer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {notificationFeedback && (
        <div className="bg-emerald-50 border-b border-emerald-100 px-4 py-1.5 text-[11px] font-bold text-emerald-700 flex items-center gap-1.5 animate-in fade-in duration-150">
          <Check className="w-3 h-3 text-emerald-600" />
          <span>{notificationFeedback}</span>
        </div>
      )}

      {/* Tabs: Details | Call Logs | Shared Files */}
      <div className="flex items-center border-b border-slate-100 px-3">
        <button
          type="button"
          onClick={() => setActiveTab('details')}
          className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer text-center ${
            activeTab === 'details'
              ? 'border-[#f95716] text-[#f95716]'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          Details
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('calls')}
          className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer text-center ${
            activeTab === 'calls'
              ? 'border-[#f95716] text-[#f95716]'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          Call Logs ({callLogs.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('files')}
          className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer text-center ${
            activeTab === 'files'
              ? 'border-[#f95716] text-[#f95716]'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          Files ({sharedFiles.length})
        </button>
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-5">
        {activeTab === 'details' && (
          <>
            {/* Section 1: About Channel or Direct Contact Info */}
            <div className="space-y-2.5">
              {conversation.type === 'direct' ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-[#f95716]" />
                      Colleague Information
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-100 space-y-1">
                    <p className="text-xs font-bold text-slate-900">{conversation.name}</p>
                    <p className="text-[11px] text-[#f95716] font-semibold">
                      {conversation.role || conversation.members?.[0]?.role || 'Direct Messaging Colleague'}
                    </p>
                    {conversation.members?.[0]?.email && (
                      <p className="text-[10.5px] text-slate-400 font-mono">
                        {conversation.members[0].email}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-[#f95716]" />
                      About Channel
                    </span>
                    {!isEditing ? (
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-[#f95716] transition-colors cursor-pointer"
                        title="Edit Channel Details"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <form onSubmit={handleSaveEdit} className="p-3 bg-slate-50/90 rounded-2xl border border-orange-200/80 space-y-2.5 animate-in fade-in duration-150">
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Channel Name</label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#f95716] focus:ring-1 focus:ring-[#f95716]"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Description / Topic</label>
                        <textarea
                          rows={2}
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Add channel description or objective..."
                          className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#f95716] focus:ring-1 focus:ring-[#f95716] resize-none"
                        />
                      </div>
                      <div className="flex justify-end gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsEditing(false)}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-200/50 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSaving || !editTitle.trim()}
                          className="px-3 py-1 rounded-lg bg-gradient-to-r from-[#e85a1a] to-[#fa8136] text-white text-xs font-bold shadow-2xs hover:opacity-95 cursor-pointer disabled:opacity-50"
                        >
                          {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-100 space-y-1">
                      <p className="text-xs font-bold text-slate-900">{conversation.name}</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        {conversation.description || 'No topic or description specified for this channel yet.'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>

              {/* 3 Summary Mini-Cards */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="block text-sm font-black text-slate-900">{totalMessagesCount}</span>
                  <span className="text-[10px] text-slate-400 font-medium">Messages</span>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="block text-sm font-black text-[#f95716]">
                    {pinnedMessages.length}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Pinned</span>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="block text-sm font-black text-slate-900">
                    {totalReactionsCount}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Reactions</span>
                </div>
              </div>

            {/* Section 2: Members */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Active Members ({conversation.members.length})
                </span>
              </div>

              {conversation.members.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No other members in this channel yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {conversation.members.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative shrink-0">
                          <div className="w-7 h-7 rounded-full bg-orange-100 text-[#f95716] font-bold text-xs flex items-center justify-center">
                            {m.avatar}
                          </div>
                          {m.status === 'online' ? (
                            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white" title="Online" />
                          ) : m.status === 'away' ? (
                            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-amber-400 ring-1 ring-white" title="Away" />
                          ) : (
                            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-slate-300 ring-1 ring-white" title={m.lastSeenHuman || 'Offline'} />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{m.name}</p>
                          <p className="text-[10.5px] text-slate-400 truncate">{m.role || 'Member'}</p>
                        </div>
                      </div>
                      <span className="text-[10px] shrink-0 font-medium">
                        {m.status === 'online' ? (
                          <span className="text-emerald-600 font-semibold">Online</span>
                        ) : m.status === 'away' ? (
                          <span className="text-amber-600 font-medium">Away</span>
                        ) : (
                          <span className="text-slate-400 font-normal">Offline</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 3: Shared Files (Preview) */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Shared Files ({sharedFiles.length})</span>
                {sharedFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('files')}
                    className="text-[11px] font-bold text-[#f95716] hover:underline cursor-pointer"
                  >
                    View all
                  </button>
                )}
              </div>

              {sharedFiles.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No files shared yet in this channel.</p>
              ) : (
                <div className="space-y-2">
                  {sharedFiles.slice(0, 2).map((file) => (
                    <div
                      key={file.id}
                      className="p-2.5 rounded-2xl bg-slate-50/70 border border-slate-100 flex items-center justify-between gap-2 group hover:bg-white hover:shadow-xs transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-orange-50 text-[#f95716]">
                          {file.extension === 'xlsx' ? (
                            <FileSpreadsheet className="w-4 h-4" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{file.name}</p>
                          <p className="text-[10px] text-slate-400">
                            {file.size} · {file.date}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDownload(file)}
                        disabled={downloadingId === file.id}
                        className="text-slate-400 hover:text-[#f95716] cursor-pointer p-1 transition-colors"
                        title="Download file"
                      >
                        {downloadingId === file.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 4: Pinned Messages */}
            <div className="space-y-2.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Pin className="w-3.5 h-3.5 text-[#f95716]" />
                  Pinned Items ({pinnedMessages.length})
                </span>
              </div>

              {pinnedMessages.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No pinned items in this channel yet.</p>
              ) : (
                <div className="space-y-2">
                  {pinnedMessages.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-2xl bg-orange-50/40 border border-orange-100/60 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="font-bold text-[#f95716] flex items-center gap-1">
                          <Pin className="w-3 h-3" />
                          {item.senderName}
                        </span>
                        <span className="text-slate-400">{item.timestamp}</span>
                      </div>
                      <p className="text-slate-700 text-[11px] leading-snug line-clamp-2">
                        {item.body}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Tab 2: Call Logs History */}
        {activeTab === 'calls' && (
          <div className="space-y-3.5">
            {/* Quick stats & call triggers */}
            <div className="p-3 bg-gradient-to-r from-orange-50/80 to-amber-50/50 rounded-2xl border border-orange-200/70 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Channel Calls
                </span>
                <span className="text-xs font-black text-slate-900">
                  {callLogs.length === 1 ? '1 Call Recorded' : `${callLogs.length} Calls Recorded`}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onStartCall?.(false)}
                  className="w-7 h-7 rounded-xl bg-white hover:bg-orange-100 text-[#f95716] border border-orange-200/80 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                  title="Start Voice Call"
                >
                  <Phone className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onStartCall?.(true)}
                  className="w-7 h-7 rounded-xl bg-[#f95716] hover:bg-[#ea580c] text-white flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                  title="Start Video Call"
                >
                  <Video className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Filter chips */}
            {callLogs.length > 0 && (
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
                {(['all', 'audio', 'video', 'missed'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setCallFilter(filter)}
                    className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer capitalize whitespace-nowrap ${
                      callFilter === filter
                        ? 'bg-orange-500/10 text-[#f95716] border border-orange-500/25'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    {filter === 'all'
                      ? `All (${callLogs.length})`
                      : filter === 'audio'
                      ? `Voice (${callLogs.filter((c) => c.type === 'audio').length})`
                      : filter === 'video'
                      ? `Video (${callLogs.filter((c) => c.type === 'video').length})`
                      : `Missed (${callLogs.filter((c) => c.status === 'missed').length})`}
                  </button>
                ))}
              </div>
            )}

            {/* Call Log List */}
            {filteredCalls.length === 0 ? (
              <div className="text-center py-10 px-4 bg-slate-50/60 rounded-3xl border border-slate-100 space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200/60 text-[#f95716] flex items-center justify-center mx-auto shadow-2xs">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-800">No call history yet</p>
                <p className="text-[11px] text-slate-400">
                  Voice and video calls initiated with {conversation.name} will be logged here.
                </p>
                <button
                  type="button"
                  onClick={() => onStartCall?.(false)}
                  className="mt-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#e85a1a] to-[#fa8136] text-white text-xs font-bold shadow-xs hover:opacity-95 transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Start Voice Call</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredCalls.map((call) => (
                  <div
                    key={call.id}
                    className="p-3 rounded-2xl bg-slate-50/70 hover:bg-white border border-slate-100 hover:border-orange-200/80 hover:shadow-xs transition-all flex items-center justify-between gap-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
                          call.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/70'
                            : 'bg-rose-50 text-rose-600 border border-rose-200/70'
                        }`}
                      >
                        {call.status === 'missed' ? (
                          <PhoneMissed className="w-4 h-4" />
                        ) : call.type === 'video' ? (
                          <Video className="w-4 h-4" />
                        ) : (
                          <Phone className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {call.type === 'video' ? 'Video Call' : 'Voice Call'}
                          </p>
                          <span
                            className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-md ${
                              call.status === 'completed'
                                ? 'bg-emerald-100/80 text-emerald-700'
                                : 'bg-rose-100/80 text-rose-700'
                            }`}
                          >
                            {call.status === 'completed' ? call.duration || 'Ended' : 'Missed'}
                          </span>
                        </div>
                        <p className="text-[10.5px] text-slate-400 mt-0.5">
                          {call.date ? `${call.date} · ` : ''}{call.timestamp}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onStartCall?.(call.type === 'video')}
                      className="w-7 h-7 rounded-xl hover:bg-orange-50 text-slate-400 hover:text-[#f95716] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      title={call.type === 'video' ? 'Start Video Call' : 'Call Back'}
                    >
                      {call.type === 'video' ? (
                        <Video className="w-3.5 h-3.5" />
                      ) : (
                        <Phone className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: All Shared Files */}
        {activeTab === 'files' && (
          <div className="space-y-2.5">
            {sharedFiles.length === 0 ? (
              <div className="text-center py-10 px-4 bg-slate-50/60 rounded-3xl border border-slate-100 space-y-2">
                <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200/60 text-[#f95716] flex items-center justify-center mx-auto">
                  <FileText className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-800">No shared files yet</p>
                <p className="text-[11px] text-slate-400">
                  Files and documents sent in this channel will be saved and organized here.
                </p>
              </div>
            ) : (
              sharedFiles.map((file) => (
                <div
                  key={file.id}
                  className="p-3 rounded-2xl bg-slate-50/70 border border-slate-100 flex items-center justify-between gap-2 group hover:bg-white hover:shadow-xs transition-all"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-orange-50 text-[#f95716]">
                      {file.extension === 'xlsx' ? (
                        <FileSpreadsheet className="w-4 h-4" />
                      ) : (
                        <FileText className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{file.name}</p>
                      <p className="text-[10.5px] text-slate-400">
                        {file.size} · Uploaded by {file.uploader}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownload(file)}
                    disabled={downloadingId === file.id}
                    className="text-slate-400 hover:text-[#f95716] cursor-pointer p-1.5 transition-colors"
                    title="Download file"
                  >
                    {downloadingId === file.id ? (
                      <Check className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
