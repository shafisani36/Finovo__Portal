import React, { useState } from 'react';
import { MessageSquare, Plus, Search, SlidersHorizontal, Users, Hash, User, Phone, Video, PhoneMissed, Paperclip } from 'lucide-react';
import { Conversation } from './types';

interface ConversationListPanelProps {
  conversations: Conversation[];
  activeConversationId: number;
  onSelectConversation: (conv: Conversation) => void;
  onNewConversation: () => void;
  availableMembers?: Array<{ id: string | number; name: string; role?: string; email?: string; status?: 'online' | 'offline' | 'away'; lastSeenHuman?: string }>;
  onStartDirectChatWithMember?: (member: any) => void;
  onStartCallWithColleague?: (member: any, isVideo: boolean) => void;
  currentUserId?: string | number;
}

export const ConversationListPanel: React.FC<ConversationListPanelProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  availableMembers = [],
  onStartDirectChatWithMember,
  onStartCallWithColleague,
  currentUserId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'direct' | 'project' | 'group'>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [filterUnreadOnly, setFilterUnreadOnly] = useState(false);
  const [filterPinnedOnly, setFilterPinnedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'unread' | 'name'>('recent');

  // Counts for tabs
  const countAll = conversations.length;
  const countDirect = conversations.filter((c) => c.type === 'direct').length;
  const countProject = conversations.filter((c) => c.type === 'project').length;
  const countGroup = conversations.filter((c) => c.type === 'group').length;

  const isFilterActive = filterUnreadOnly || filterPinnedOnly || sortBy !== 'recent';

  // Colleagues matching search (excluding current user to prevent self-chat/self-calling)
  const matchingMembers = searchQuery.trim()
    ? availableMembers
        .filter(
          (m) =>
            (!currentUserId || String(m.id) !== String(currentUserId)) &&
            (m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (m.role && m.role.toLowerCase().includes(searchQuery.toLowerCase())))
        )
        .slice(0, 5)
    : [];

  const filtered = conversations
    .filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab = filterTab === 'all' || c.type === filterTab;
      const matchesUnread = !filterUnreadOnly || c.unreadCount > 0;
      const matchesPinned = !filterPinnedOnly || !!c.isPinned;
      return matchesSearch && matchesTab && matchesUnread && matchesPinned;
    })
    .sort((a, b) => {
      if (sortBy === 'unread') {
        return (b.unreadCount || 0) - (a.unreadCount || 0);
      }
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      }
      // default: recent / pinned first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return 0;
    });

  return (
    <div className="w-full h-full bg-white rounded-3xl border border-slate-100/90 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex flex-col overflow-hidden">
      {/* Top Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-500/10 border border-orange-500/15 flex items-center justify-center text-[#f95716]">
            <MessageSquare className="w-4 h-4 stroke-[2.2]" />
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
            Messages
          </h2>
        </div>

        {/* Orange Plus Action Button */}
        <button
          type="button"
          onClick={onNewConversation}
          className="w-8 h-8 rounded-xl bg-gradient-to-r from-[#e85a1a] to-[#fa8136] hover:opacity-95 text-white flex items-center justify-center shadow-[0_3px_10px_rgba(249,87,22,0.25)] transition-all cursor-pointer active:scale-95"
          title="New Conversation"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>

      {/* Search Bar & Filter Options */}
      <div className="px-4 pt-3 pb-2 relative">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search messages, channels, or colleagues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-8 py-2 rounded-xl bg-slate-50/80 border border-slate-200/70 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#f95716] focus:ring-2 focus:ring-[#f95716]/10 transition-all"
          />
          <button
            type="button"
            onClick={() => setShowFilterDropdown((prev) => !prev)}
            className={`absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              isFilterActive || showFilterDropdown
                ? 'bg-orange-100 text-[#f95716]'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
            title="Filter and sort options"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Filter Popover Dropdown */}
        {showFilterDropdown && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setShowFilterDropdown(false)}
            />
            <div className="absolute left-4 right-4 top-full mt-1.5 p-3.5 bg-white rounded-2xl border border-orange-200/90 shadow-xl space-y-3 text-xs animate-in fade-in zoom-in-95 z-30">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3 h-3 text-[#f95716]" />
                  Filter Conversations
                </span>
              <button
                type="button"
                onClick={() => {
                  setFilterUnreadOnly(false);
                  setFilterPinnedOnly(false);
                  setSortBy('recent');
                }}
                className="text-[11px] font-bold text-[#f95716] hover:underline cursor-pointer"
              >
                Reset
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 font-semibold select-none group p-1.5 rounded-xl hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={filterUnreadOnly}
                  onChange={(e) => setFilterUnreadOnly(e.target.checked)}
                  className="rounded text-[#f95716] focus:ring-[#f95716] border-slate-300 w-4 h-4 cursor-pointer accent-[#f95716]"
                />
                <span className="group-hover:text-slate-900 transition-colors text-xs">Unread messages only</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer text-slate-700 font-semibold select-none group p-1.5 rounded-xl hover:bg-slate-50 transition-colors">
                <input
                  type="checkbox"
                  checked={filterPinnedOnly}
                  onChange={(e) => setFilterPinnedOnly(e.target.checked)}
                  className="rounded text-[#f95716] focus:ring-[#f95716] border-slate-300 w-4 h-4 cursor-pointer accent-[#f95716]"
                />
                <span className="group-hover:text-slate-900 transition-colors text-xs">Pinned conversations only</span>
              </label>
            </div>

            <div className="border-t border-slate-100 pt-2 space-y-1.5">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Sort Ordering
              </span>
              <div className="grid grid-cols-3 gap-1">
                {(['recent', 'unread', 'name'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSortBy(mode)}
                    className={`py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                      sortBy === mode
                        ? 'bg-[#f95716] text-white shadow-2xs'
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {mode === 'recent' ? 'Recent' : mode === 'unread' ? 'Unread' : 'A-Z'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>

      {/* Filter Tabs */}
      <div className="px-3 pb-2 flex items-center gap-1 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setFilterTab('all')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
            filterTab === 'all'
              ? 'bg-orange-500/10 text-[#f95716] border border-orange-500/20'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          All ({countAll})
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('direct')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
            filterTab === 'direct'
              ? 'bg-orange-500/10 text-[#f95716] border border-orange-500/20'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          Direct ({countDirect})
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('project')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
            filterTab === 'project'
              ? 'bg-orange-500/10 text-[#f95716] border border-orange-500/20'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          Projects ({countProject})
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('group')}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
            filterTab === 'group'
              ? 'bg-orange-500/10 text-[#f95716] border border-orange-500/20'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
          }`}
        >
          Groups ({countGroup})
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
        {filtered.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 border border-orange-200/60 text-[#f95716] flex items-center justify-center mx-auto shadow-2xs">
              <MessageSquare className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">No conversations yet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Start a direct message or team channel.</p>
            </div>
            <button
              type="button"
              onClick={onNewConversation}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#e85a1a] to-[#fa8136] text-white text-xs font-bold shadow-xs hover:opacity-95 transition-all cursor-pointer"
            >
              Start Conversation
            </button>
          </div>
        ) : (
          filtered.map((conv) => {
            const isActive = conv.id === activeConversationId;
            return (
              <div
                key={conv.id}
                onClick={() => onSelectConversation(conv)}
                className={`group p-2.5 rounded-2xl flex items-center gap-3 cursor-pointer transition-all duration-150 border ${
                  isActive
                    ? 'bg-orange-50/70 border-orange-200/80 shadow-[0_2px_12px_rgba(249,87,22,0.06)]'
                    : 'border-transparent hover:bg-slate-50/80 hover:border-slate-100'
                }`}
              >
                {/* Avatar with Initials */}
                <div className="relative shrink-0">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs uppercase shadow-2xs border ${conv.avatarColor}`}
                  >
                    {conv.avatar}
                  </div>
                  {/* Real Presence indicator */}
                  {conv.type === 'direct' ? (
                    conv.status === 'online' ? (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white shadow-2xs" title="Online" />
                    ) : conv.status === 'away' ? (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-white shadow-2xs" title="Away" />
                    ) : (
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-slate-300 ring-2 ring-white" title={conv.lastSeenHuman || 'Offline'} />
                    )
                  ) : conv.onlineMembersCount !== undefined && conv.onlineMembersCount > 0 ? (
                    <span
                      className="absolute bottom-0 right-0 min-w-3.5 h-3.5 px-0.5 rounded-full bg-emerald-500 text-[8.5px] font-black text-white ring-2 ring-white flex items-center justify-center shadow-2xs"
                      title={`${conv.onlineMembersCount} online`}
                    >
                      {conv.onlineMembersCount}
                    </span>
                  ) : null}
                </div>

                {/* Body / Snippet */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <h3
                      className={`text-xs font-bold truncate transition-colors ${
                        isActive ? 'text-slate-900' : 'text-slate-800 group-hover:text-slate-900'
                      }`}
                    >
                      {conv.name}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-medium shrink-0">
                      {conv.lastMessageTime}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className={`text-[11px] truncate max-w-[170px] leading-tight ${conv.lastMessage ? 'text-slate-400' : 'text-slate-300 italic'}`}>
                      {(() => {
                        if (!conv.lastMessage) return 'No messages yet';
                        const clean = conv.lastMessage.replace(/^[📞📹📎📅]\s*/, '').trim();
                        const lower = clean.toLowerCase();
                        if (lower.includes('missed') && lower.includes('call')) {
                          return (
                            <span className="inline-flex items-center gap-1 text-rose-500 font-semibold truncate">
                              <PhoneMissed className="w-3 h-3 shrink-0" />
                              <span className="truncate">{clean}</span>
                            </span>
                          );
                        }
                        if (lower.includes('video call')) {
                          return (
                            <span className="inline-flex items-center gap-1 text-slate-500 truncate">
                              <Video className="w-3 h-3 text-orange-500 shrink-0" />
                              <span className="truncate">{clean}</span>
                            </span>
                          );
                        }
                        if (lower.includes('voice call') || lower.includes('call ended')) {
                          return (
                            <span className="inline-flex items-center gap-1 text-slate-500 truncate">
                              <Phone className="w-3 h-3 text-emerald-500 shrink-0" />
                              <span className="truncate">{clean}</span>
                            </span>
                          );
                        }
                        if (lower.startsWith('shared file:')) {
                          return (
                            <span className="inline-flex items-center gap-1 text-slate-500 truncate">
                              <Paperclip className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{clean}</span>
                            </span>
                          );
                        }
                        return clean;
                      })()}
                    </div>

                    {/* Unread badge */}
                    {conv.unreadCount > 0 && (
                      <span className="shrink-0 min-w-4 h-4 px-1 rounded-full bg-[#f95716] text-white text-[9.5px] font-black flex items-center justify-center shadow-xs">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Quick Colleagues Directory (Click to instant chat) */}
        {matchingMembers.length > 0 && (
          <div className="pt-3 pb-1 px-1 border-t border-slate-100 mt-2 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block px-1">
              Colleagues in Organization
            </span>
            <div className="space-y-1">
              {matchingMembers.map((member) => (
                <div
                  key={member.id}
                  className="p-2 rounded-xl border border-dashed border-orange-200/90 hover:border-[#f95716] bg-orange-50/20 hover:bg-orange-50/70 flex items-center justify-between gap-2 transition-all"
                >
                  <div
                    onClick={() => onStartDirectChatWithMember?.(member)}
                    className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                    title="Click to start direct chat"
                  >
                    <div className="w-7 h-7 rounded-full bg-orange-100 text-[#f95716] font-bold text-[11px] flex items-center justify-center shrink-0">
                      {member.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{member.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{member.role || 'Colleague'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onStartDirectChatWithMember?.(member)}
                      className="text-[10px] font-bold text-[#f95716] px-2 py-1 rounded-lg bg-white border border-orange-200 hover:bg-orange-50 cursor-pointer shadow-2xs"
                      title="Open Chat"
                    >
                      Chat
                    </button>
                    <button
                      type="button"
                      onClick={() => onStartCallWithColleague?.(member, false)}
                      className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 flex items-center justify-center cursor-pointer shadow-2xs"
                      title="Direct Audio Call"
                    >
                      <Phone className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onStartCallWithColleague?.(member, true)}
                      className="w-6 h-6 rounded-lg bg-orange-50 text-[#f95716] hover:bg-orange-100 border border-orange-200 flex items-center justify-center cursor-pointer shadow-2xs"
                      title="Direct Video Call"
                    >
                      <Video className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
