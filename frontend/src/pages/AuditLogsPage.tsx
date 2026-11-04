import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Shield, Loader2, ArrowLeft, ArrowRight, User } from 'lucide-react';
import { AppShell } from '../components/layouts/AppShell';
import api from '../lib/api';

interface AuditEvent {
  id: number;
  event_type: string;
  target_type: string | null;
  target_id: string | null;
  ip_address: string | null;
  created_at: string;
  actor: {
    id: number;
    name: string;
    email: string;
  } | null;
  metadata: Record<string, any> | null;
}

export const AuditLogsPage: React.FC = () => {
  const { companySlug } = useParams<{ companySlug: string }>();

  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAuditLogs = async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get(`/companies/${companySlug}/audit-events?page=${page}`);
      setEvents(res.data.data || []);
      setCurrentPage(res.data.current_page || 1);
      setLastPage(res.data.last_page || 1);
      setTotal(res.data.total || 0);
    } catch {
      // Handled
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (companySlug) {
      fetchAuditLogs(currentPage);
    }
  }, [companySlug, currentPage]);

  return (
    <AppShell
      title="Security Audit Trail"
      subtitle={`Tamper-evident record of administrative and tenant changes (${total} total events)`}
    >
      <div className="space-y-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
          {loading ? (
            <div className="py-24 flex items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-[#F95716]" />
            </div>
          ) : events.length === 0 ? (
            <div className="py-20 text-center text-slate-400 space-y-2">
              <FileText className="w-10 h-10 mx-auto text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">No audit events recorded</p>
              <p className="text-xs text-slate-500">Security actions and modifications will appear here automatically.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Event Type</th>
                    <th className="px-5 py-3.5">Actor</th>
                    <th className="px-5 py-3.5">Target</th>
                    <th className="px-5 py-3.5">IP Address</th>
                    <th className="px-5 py-3.5">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {events.map((evt) => (
                    <tr key={evt.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-bold text-slate-900 font-mono text-xs">{evt.event_type}</span>
                      </td>

                      <td className="px-5 py-3.5">
                        {evt.actor ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                              {evt.actor.name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-800">{evt.actor.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{evt.actor.email}</p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">System Automation</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 font-mono text-[11px] text-slate-500">
                        {evt.target_type ? `${evt.target_type} #${evt.target_id}` : '—'}
                      </td>

                      <td className="px-5 py-3.5 font-mono text-[11px] text-slate-500">
                        {evt.ip_address || '127.0.0.1'}
                      </td>

                      <td className="px-5 py-3.5 text-slate-400 font-mono text-[11px]">
                        {new Date(evt.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {lastPage > 1 && (
            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Page <span className="font-bold text-slate-700">{currentPage}</span> of{' '}
                <span className="font-bold text-slate-700">{lastPage}</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Previous
                </button>
                <button
                  disabled={currentPage >= lastPage}
                  onClick={() => setCurrentPage((p) => Math.min(p + 1, lastPage))}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition-colors"
                >
                  Next <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
};
