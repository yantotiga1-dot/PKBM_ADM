import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  Mail,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldAlert,
} from 'lucide-react';
import { TutorNotification } from '../types';

interface TutorNotificationsProps {
  notifications: TutorNotification[];
  isWorkspaceConnected: boolean;
  onScanCompetencies: () => number;
  onRequestSendEmail: (notif: TutorNotification, overrideEmail?: string) => void;
  onSendWhatsApp: (notif: TutorNotification) => void;
  onGenerateRemedialForAlert: (notif: TutorNotification) => void;
  onMarkResolved: (notifId: string) => void;
  onConnectWorkspace: () => void;
}

export const TutorNotifications: React.FC<TutorNotificationsProps> = ({
  notifications,
  isWorkspaceConnected,
  onScanCompetencies,
  onRequestSendEmail,
  onSendWhatsApp,
  onGenerateRemedialForAlert,
  onMarkResolved,
  onConnectWorkspace,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('Semua');
  const [customEmails, setCustomEmails] = useState<Record<string, string>>({});
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return notifications
      .filter(
        (n) => statusFilter === 'Semua' || n.statusKirim === statusFilter
      )
      .sort((a, b) => b.waktuTerdeteksi.localeCompare(a.waktuTerdeteksi));
  }, [notifications, statusFilter]);

  const pendingCount = useMemo(
    () =>
      notifications.filter((n) => n.statusKirim === 'Menunggu Tindakan').length,
    [notifications]
  );

  const highRiskCount = useMemo(
    () =>
      notifications.filter((n) => n.riskLevel === 'Tinggi (Drop-Out)').length,
    [notifications]
  );

  const handleScan = () => {
    const added = onScanCompetencies();
    setScanMessage(
      added > 0
        ? `Pemindaian EWS selesai: ditemukan ${added} risiko drop-out / target belum tercapai baru.`
        : 'Pemindaian EWS selesai. Tidak ada temuan baru di luar daftar saat ini.'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Early Warning System (EWS) Drop-Out, Peringatan Multi-Kanal (WhatsApp, Portal & Gmail) & Remidial Otomatis
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Notifikasi Tutor & EWS Drop-Out
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {!isWorkspaceConnected && (
            <button
              type="button"
              onClick={onConnectWorkspace}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              Hubungkan Gmail
            </button>
          )}
          <button
            type="button"
            onClick={handleScan}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Pindai EWS & Target Kompetensi</span>
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Risiko Tinggi (Drop-Out EWS)</p>
          <p className="mt-1 font-mono text-2xl font-bold text-red-700 tabular-nums">
            {highRiskCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Kombinasi kehadiran &lt; 75% dan nilai &lt; KKM
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Menunggu Tindakan Tutor</p>
          <p className="mt-1 font-mono text-2xl font-bold text-amber-700 tabular-nums">
            {pendingCount}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Tersedia pengiriman cepat WhatsApp, Gmail & Remidial
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total Peringatan Tercatat</p>
          <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {notifications.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Terintegrasi langsung ke Portal Mandiri Siswa
          </p>
        </div>
      </div>

      {scanMessage && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs font-medium text-blue-800">
          {scanMessage}
        </div>
      )}

      {/* Filter Bar */}
      <div className="inline-flex flex-wrap rounded-lg bg-slate-100 p-1">
        {[
          'Semua',
          'Menunggu Tindakan',
          'Terkirim via WhatsApp',
          'Terkirim via Gmail',
          'Ditandai Selesai',
        ].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              statusFilter === st
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {st}
            {st === 'Menunggu Tindakan' ? ` (${pendingCount})` : ''}
          </button>
        ))}
      </div>

      {/* Notification List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
            Tidak ada notifikasi pada kategori ini.
          </div>
        ) : (
          filtered.map((notif) => {
            const targetEmail =
              customEmails[notif.id] !== undefined
                ? customEmails[notif.id]
                : notif.tutorEmail;

            return (
              <div
                key={notif.id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {notif.riskLevel === 'Tinggi (Drop-Out)' ? (
                        <span className="inline-flex items-center gap-1 font-bold text-red-700">
                          <ShieldAlert className="h-4 w-4" />
                          EWS Risiko Drop-Out
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                          <AlertTriangle className="h-4 w-4" />
                          Risiko {notif.riskLevel}
                        </span>
                      )}
                      <span className="text-slate-300">·</span>
                      {notif.statusKirim === 'Menunggu Tindakan' ? (
                        <span className="font-medium text-amber-800">
                          Menunggu Tindakan
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {notif.statusKirim}
                        </span>
                      )}
                      <span className="text-slate-300">·</span>
                      <span className="font-mono text-slate-500 tabular-nums">
                        {notif.waktuTerdeteksi.slice(0, 16).replace('T', ' ')}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900">
                      {notif.learnerNama}{' '}
                      <span className="font-normal text-slate-500">
                        ({notif.program}) — {notif.kompetensi}
                      </span>
                    </h3>

                    <p className="text-sm text-slate-600">{notif.pemicu}</p>

                    <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-600">
                      <span>
                        Tutor:{' '}
                        <strong className="text-slate-800">
                          {notif.tutorNama}
                        </strong>
                      </span>
                      <span className="font-mono tabular-nums">
                        Capaian:{' '}
                        <strong className="text-red-700">
                          {notif.skorCapaian}
                        </strong>{' '}
                        / Target {notif.targetNilai}
                      </span>
                      {notif.remedialQuizId && (
                        <span className="font-mono font-semibold text-blue-700">
                          Soal Remidial Diterbitkan ({notif.remedialQuizId})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Multi-channel Action Controls */}
                  <div className="flex flex-col gap-2 sm:items-end">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSendWhatsApp(notif)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 whitespace-nowrap"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>Kirim WhatsApp Tutor</span>
                      </button>

                      {!notif.remedialQuizId && (
                        <button
                          type="button"
                          onClick={() => onGenerateRemedialForAlert(notif)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-700 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 whitespace-nowrap"
                        >
                          <BookOpenCheck className="h-3.5 w-3.5" />
                          <span>Terbitkan Remidial</span>
                        </button>
                      )}

                      {notif.statusKirim === 'Menunggu Tindakan' && (
                        <button
                          type="button"
                          onClick={() => onMarkResolved(notif.id)}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          Tandai Selesai
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <input
                          type="email"
                          value={targetEmail}
                          onChange={(e) =>
                            setCustomEmails((prev) => ({
                              ...prev,
                              [notif.id]: e.target.value,
                            }))
                          }
                          aria-label={`Email tutor untuk ${notif.learnerNama}`}
                          className="w-48 bg-transparent font-mono text-xs text-slate-800 focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => onRequestSendEmail(notif, targetEmail)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                      >
                        <Send className="h-3 w-3" />
                        <span>Gmail</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
