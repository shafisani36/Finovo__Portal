import React, { useState } from 'react';
import { MessageSquare, Users, Folder, X, Search, Check, ShieldCheck, UserCheck } from 'lucide-react';
import { Conversation } from './types';

export interface MemberOption {
  id: string | number;
  name: string;
  role?: string;
  email?: string;
  status?: 'online' | 'offline' | 'away';
  lastSeenHuman?: string;
}

interface NewConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (conv: Partial<Conversation>, recipientUserId?: number, memberUserIds?: number[]) => void;
  availableMembers?: MemberOption[];
  currentUserId?: string | number;
}

export const NewConversationModal: React.FC<NewConversationModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  availableMembers = [],
  currentUserId,
}) => {
  const [type, setType] = useState<'direct' | 'group' | 'project'>('direct');
  const [name, setName] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | number | null>(null);
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState<number[]>([]);
  const [searchMember, setSearchMember] = useState('');

  if (!isOpen) return null;

  // Strictly filter to organization colleagues, excluding current user from direct choices
  const colleagues = availableMembers.filter(
    (m) => !currentUserId || String(m.id) !== String(currentUserId)
  );

  const filteredMembers = colleagues.filter(
    (m) =>
      m.name.toLowerCase().includes(searchMember.toLowerCase()) ||
      (m.role && m.role.toLowerCase().includes(searchMember.toLowerCase())) ||
      (m.email && m.email.toLowerCase().includes(searchMember.toLowerCase()))
  );

  const selectedMember = colleagues.find((m) => String(m.id) === String(selectedMemberId));

  const handleToggleGroupMember = (id: number) => {
    setSelectedGroupMemberIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (type === 'direct') {
      if (!selectedMember) return;
      const convName = selectedMember.name;

      onCreate(
        {
          name: convName,
          type: 'direct',
          avatar: convName.substring(0, 2).toUpperCase(),
          avatarColor: 'bg-orange-50 text-[#f95716] border-orange-200',
          status: selectedMember.status || 'offline',
          lastSeenHuman: selectedMember.lastSeenHuman,
          lastMessage: '',
          lastMessageTime: '',
          unreadCount: 0,
        },
        Number(selectedMember.id)
      );
    } else {
      if (!name.trim()) return;
      onCreate(
        {
          name: name.trim(),
          type,
          avatar: name.substring(0, 2).toUpperCase(),
          avatarColor: 'bg-orange-50 text-[#f95716] border-orange-200',
          status: 'offline',
          lastMessage: '',
          lastMessageTime: '',
          unreadCount: 0,
        },
        undefined,
        selectedGroupMemberIds
      );
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-orange-50 border border-orange-200/80 flex items-center justify-center text-[#f95716]">
              <MessageSquare className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
                New Conversation
              </h3>
              <p className="text-xs text-slate-400">Select an organization member or create a channel</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Type Selector (Direct vs Group vs Project) */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setType('direct')}
            className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              type === 'direct'
                ? 'bg-orange-50 text-[#f95716] border border-orange-200/80 shadow-2xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Direct
          </button>
          <button
            type="button"
            onClick={() => setType('group')}
            className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              type === 'group'
                ? 'bg-orange-50 text-[#f95716] border border-orange-200/80 shadow-2xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Group
          </button>
          <button
            type="button"
            onClick={() => setType('project')}
            className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              type === 'project'
                ? 'bg-orange-50 text-[#f95716] border border-orange-200/80 shadow-2xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
          >
            Project
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {type !== 'direct' ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {type === 'project' ? 'Project Channel Name' : 'Group Channel Name'}
              </label>
              <input
                type="text"
                placeholder={type === 'project' ? 'e.g. Project Apollo & Infrastructure' : 'e.g. Engineering Lead Sync'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-900 focus:outline-none focus:border-[#f95716] focus:ring-2 focus:ring-[#f95716]/10"
                required
              />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700">
                Organization Colleagues ({colleagues.length})
              </label>
              {selectedMember && (
                <span className="text-[11px] font-bold text-[#f95716] flex items-center gap-1">
                  <UserCheck className="w-3 h-3" />
                  {selectedMember.name}
                </span>
              )}
            </div>
          )}

          {/* Member Search Bar */}
          <div>
            {type !== 'direct' && (
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Add Team Members ({selectedGroupMemberIds.length} selected)
              </label>
            )}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search colleagues by name, role, email..."
                value={searchMember}
                onChange={(e) => setSearchMember(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs focus:outline-none focus:border-[#f95716] focus:ring-2 focus:ring-[#f95716]/10"
              />
            </div>
          </div>

          {/* Organization Members List */}
          <div className="max-h-52 overflow-y-auto space-y-1.5 p-1 custom-scrollbar border border-slate-100 rounded-2xl bg-slate-50/30">
            {filteredMembers.length === 0 ? (
              <div className="p-6 text-center space-y-1.5">
                <Users className="w-6 h-6 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-700">No colleagues found</p>
                <p className="text-[11px] text-slate-400">
                  {colleagues.length === 0
                    ? 'No other members in this company yet.'
                    : 'No colleagues match your search query.'}
                </p>
              </div>
            ) : (
              filteredMembers.map((m) => {
                const isSelected =
                  type === 'direct'
                    ? String(selectedMemberId) === String(m.id)
                    : selectedGroupMemberIds.includes(Number(m.id));

                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      if (type === 'direct') {
                        setSelectedMemberId(m.id);
                      } else {
                        handleToggleGroupMember(Number(m.id));
                      }
                    }}
                    className={`p-2.5 rounded-2xl flex items-center justify-between text-xs cursor-pointer transition-all duration-150 border ${
                      isSelected
                        ? 'bg-orange-50/80 text-[#f95716] font-bold border-orange-300 shadow-2xs'
                        : 'bg-white hover:bg-slate-50/80 text-slate-800 border-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Avatar with live presence */}
                      <div className="relative shrink-0">
                        <div className="w-8 h-8 rounded-full bg-orange-100/90 text-[#f95716] border border-orange-200/60 font-bold text-xs flex items-center justify-center">
                          {m.name.substring(0, 2).toUpperCase()}
                        </div>
                        {m.status === 'online' ? (
                          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-1 ring-white" title="Online" />
                        ) : m.status === 'away' ? (
                          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-amber-400 ring-1 ring-white" title="Away" />
                        ) : (
                          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-slate-300 ring-1 ring-white" title="Offline" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-slate-900 truncate text-xs">{m.name}</p>
                          {m.status === 'online' ? (
                            <span className="text-[9.5px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded-md">Online</span>
                          ) : m.status === 'away' ? (
                            <span className="text-[9.5px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded-md">Away</span>
                          ) : (
                            <span className="text-[9.5px] font-normal text-slate-400">Offline</span>
                          )}
                        </div>
                        <p className="text-[10.5px] text-slate-400 truncate flex items-center gap-1.5">
                          <span>{m.role || 'Member'}</span>
                          {m.email && <span className="text-slate-300">· {m.email}</span>}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 pl-2">
                      {isSelected ? (
                        <div className="w-5 h-5 rounded-full bg-[#f95716] text-white flex items-center justify-center shadow-2xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border border-slate-300/80 hover:border-[#f95716]" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={type === 'direct' ? !selectedMemberId : !name.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#e85a1a] via-[#f36b24] to-[#fa8136] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-[0_3px_12px_rgba(249,87,22,0.22)] transition-all cursor-pointer hover:opacity-95 active:scale-95"
            >
              {type === 'direct'
                ? selectedMember
                  ? `Chat with ${selectedMember.name}`
                  : 'Select a Colleague'
                : 'Create Channel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
