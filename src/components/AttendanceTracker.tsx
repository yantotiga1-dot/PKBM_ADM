import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CalendarCheck,
  Check,
  CheckCheck,
  Clock,
  CloudOff,
  QrCode,
  RefreshCw,
  Wifi,
  WifiOff,
  XCircle,
} from 'lucide-react';
import {
  AttendanceRecord,
  AttendanceStatus,
  Learner,
  LearningMode,
  LeaveRequest,
} from '../types';

interface AttendanceTrackerProps {
  institutionId: string;
  learners: Learner[];
  attendance: AttendanceRecord[];
  leaveRequests: LeaveRequest[];
  pendingOfflineCount: number;
  isOfflineSimulated: boolean;
  isOnlineBrowser: boolean;
  onToggleOfflineSim: () => void;
  onSyncOfflineQueue: () => void;
  onUpsertAttendance: (record: AttendanceRecord, forceOfflineQueue?: boolean) => void;
  onBulkMarkPresent: (
    tanggal: string,
    learnerIds: string[],
    modePembelajaran: LearningMode
  ) => void;
  onResolveLeaveRequest: (id: string, approve: boolean) => void;
}

const STATUS_OPTIONS: Array<{
  value: AttendanceStatus;
  label: string;
  activeClass: string;
}> = [
  {
    value: 'Hadir',
    label: 'Hadir',
    activeClass: 'bg-emerald-700 text-white border-emerald-700',
  },
  {
    value: 'Izin',
    label: 'Izin',
    activeClass: 'bg-blue-700 text-white border-blue-700',
  },
  {
    value: 'Sakit',
    label: 'Sakit',
    activeClass: 'bg-amber-600 text-white border-amber-600',
  },
  {
    value: 'Alfa',
    label: 'Alfa',
    activeClass: 'bg-red-600 text-white border-red-600',
  },
];

const LEARNING_MODES: LearningMode[] = ['Tatap Muka', 'Tutorial', 'Mandiri'];

export const AttendanceTracker: React.FC<AttendanceTrackerProps> = ({
  institutionId,
  learners,
  attendance,
  leaveRequests,
  pendingOfflineCount,
  isOfflineSimulated,
  isOnlineBrowser,
  onToggleOfflineSim,
  onSyncOfflineQueue,
  onUpsertAttendance,
  onBulkMarkPresent,
  onResolveLeaveRequest,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>('2026-11-15');
  const [selectedMode, setSelectedMode] = useState<LearningMode>('Tatap Muka');
  const [programFilter, setProgramFilter] = useState<string>('Semua');
  const [qrInput, setQrInput] = useState('');
  const [qrFeedback, setQrFeedback] = useState<string | null>(null);

  const effectivelyOffline = isOfflineSimulated || !isOnlineBrowser;

  const visibleLearners = useMemo(
    () =>
      learners.filter(
        (l) => programFilter === 'Semua' || l.program === programFilter
      ),
    [learners, programFilter]
  );

  const recordsByLearner = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const rec of attendance) {
      if (rec.tanggal === selectedDate) {
        map.set(rec.learnerId, rec);
      }
    }
    return map;
  }, [attendance, selectedDate]);

  const pendingLeaves = useMemo(
    () => leaveRequests.filter((lr) => lr.status === 'Menunggu'),
    [leaveRequests]
  );

  const dailySummary = useMemo(() => {
    let hadir = 0;
    let izin = 0;
    let sakit = 0;
    let alfa = 0;
    let belum = 0;

    for (const l of visibleLearners) {
      const rec = recordsByLearner.get(l.id);
      if (!rec) belum++;
      else if (rec.status === 'Hadir') hadir++;
      else if (rec.status === 'Izin') izin++;
      else if (rec.status === 'Sakit') sakit++;
      else if (rec.status === 'Alfa') alfa++;
    }
    return { hadir, izin, sakit, alfa, belum };
  }, [visibleLearners, recordsByLearner]);

  const handleSetStatus = (
    learnerId: string,
    status: AttendanceStatus,
    catatan = '',
    sumber: AttendanceRecord['sumber'] = 'Manual'
  ) => {
    const existing = recordsByLearner.get(learnerId);
    const now = new Date();
    const waktu = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    onUpsertAttendance(
      {
        id: existing?.id || `ABS-${selectedDate}-${learnerId}`,
        institutionId,
        tanggal: selectedDate,
        learnerId,
        status,
        modePembelajaran: existing?.modePembelajaran || selectedMode,
        waktuCatat: existing?.waktuCatat || waktu,
        catatan: catatan !== '' ? catatan : existing?.catatan || '',
        sumber: effectivelyOffline ? 'QR Offline' : sumber,
        pendingSync: effectivelyOffline,
      },
      effectivelyOffline
    );
  };

  const handleNoteChange = (learnerId: string, catatan: string) => {
    const existing = recordsByLearner.get(learnerId);
    onUpsertAttendance(
      {
        id: existing?.id || `ABS-${selectedDate}-${learnerId}`,
        institutionId,
        tanggal: selectedDate,
        learnerId,
        status: existing?.status || 'Hadir',
        modePembelajaran: existing?.modePembelajaran || selectedMode,
        waktuCatat: existing?.waktuCatat || '08:00',
        catatan,
        sumber: existing?.sumber || 'Manual',
        pendingSync: effectivelyOffline,
      },
      effectivelyOffline
    );
  };

  const handleQrCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = qrInput.trim();
    if (!raw) return;

    let code = raw;
    if (raw.includes('verify=')) {
      const m = raw.match(/verify=([^&\s]+)/);
      if (m) code = m[1];
    }

    const found = learners.find(
      (l) =>
        l.id.toLowerCase() === code.toLowerCase() ||
        l.nisn.toLowerCase() === code.toLowerCase()
    );
    if (!found) {
      setQrFeedback(`Kode "${raw}" tidak cocok dengan warga belajar lembaga ini.`);
      return;
    }

    handleSetStatus(
      found.id,
      'Hadir',
      effectivelyOffline
        ? `Presensi QR Offline (${selectedMode}) — tersimpan di IndexedDB`
        : `Presensi QR (${selectedMode})`,
      'QR Offline'
    );
    setQrFeedback(
      effectivelyOffline
        ? `Tersimpan Offline (IndexedDB): ${found.nama} — akan otomatis tersinkron saat online.`
        : `Tercatat Hadir: ${found.nama} (${selectedMode})`
    );
    setQrInput('');
  };

  return (
    <div className="space-y-6">
      {/* Header + Offline-First Controls */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Presensi Offline-First (IndexedDB) & Pencatatan Jalur SKK Kesetaraan
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Absensi Harian Warga Belajar
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleOfflineSim}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
              effectivelyOffline
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {effectivelyOffline ? (
              <>
                <WifiOff className="h-3.5 w-3.5 text-amber-700" />
                <span>Mode Offline Aktif (Simulasi Sinyal Lemah)</span>
              </>
            ) : (
              <>
                <Wifi className="h-3.5 w-3.5 text-emerald-700" />
                <span>Online · Uji Mode Offline</span>
              </>
            )}
          </button>

          {pendingOfflineCount > 0 && (
            <button
              type="button"
              disabled={effectivelyOffline}
              onClick={onSyncOfflineQueue}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>
                Sinkron Antrean Offline ({pendingOfflineCount})
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              onBulkMarkPresent(
                selectedDate,
                visibleLearners.map((l) => l.id),
                selectedMode
              )
            }
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap"
          >
            <CheckCheck className="h-4 w-4" />
            <span>Tandai Semua Hadir</span>
          </button>
        </div>
      </div>

      {/* Offline Queue Banner */}
      {(effectivelyOffline || pendingOfflineCount > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <CloudOff className="h-4 w-4 shrink-0 text-amber-700" />
            <span>
              {effectivelyOffline
                ? 'Perangkat berada dalam mode offline. Seluruh pemindaian QR dan absensi disimpan aman di IndexedDB lokal dan tidak hilang saat halaman dimuat ulang.'
                : `Terdapat ${pendingOfflineCount} catatan presensi dari IndexedDB lokal yang siap disinkronkan.`}
            </span>
          </div>
          {!effectivelyOffline && pendingOfflineCount > 0 && (
            <button
              type="button"
              onClick={onSyncOfflineQueue}
              className="font-semibold text-amber-950 underline"
            >
              Sinkronkan Sekarang
            </button>
          )}
        </div>
      )}

      {/* Pending Leave Requests from Portal Mandiri */}
      {pendingLeaves.length > 0 && (
        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
          <h2 className="text-xs font-bold text-blue-950">
            Pengajuan Izin Mandiri dari Warga Belajar ({pendingLeaves.length} Menunggu Persetujuan)
          </h2>
          <div className="mt-2.5 space-y-2">
            {pendingLeaves.map((lr) => (
              <div
                key={lr.id}
                className="flex flex-col justify-between gap-2 rounded-lg border border-blue-200 bg-white px-3.5 py-2.5 text-xs sm:flex-row sm:items-center"
              >
                <div>
                  <span className="font-semibold text-slate-900">
                    {lr.learnerNama}
                  </span>{' '}
                  · <span className="font-mono">{lr.tanggal}</span> ·{' '}
                  <span className="font-semibold text-blue-700">{lr.jenis}</span>
                  <p className="mt-0.5 text-slate-600">{lr.alasan}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onResolveLeaveRequest(lr.id, true)}
                    className="rounded-md bg-emerald-700 px-3 py-1.5 font-medium text-white hover:bg-emerald-800"
                  >
                    Setujui & Catat Absensi
                  </button>
                  <button
                    type="button"
                    onClick={() => onResolveLeaveRequest(lr.id, false)}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Tolak
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls & QR Check-in Bar */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 lg:col-span-7">
          <div>
            <label className="block text-xs font-semibold text-slate-600">
              Tanggal Pertemuan
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600">
              Jalur SKK Pertemuan
            </label>
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value as LearningMode)}
              className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-blue-600 focus:outline-none"
            >
              {LEARNING_MODES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-600">
              Filter Program
            </label>
            <div className="mt-1 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
              {['Semua', 'Paket A', 'Paket B', 'Paket C', 'Kursus Vokasi'].map(
                (prog) => (
                  <button
                    key={prog}
                    type="button"
                    onClick={() => setProgramFilter(prog)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      programFilter === prog
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {prog}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        <form
          onSubmit={handleQrCheckIn}
          className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-5"
        >
          <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <QrCode className="h-3.5 w-3.5 text-blue-700" />
            <span>
              Scanner QR Presensi ({effectivelyOffline ? 'Offline IndexedDB' : 'Online'})
            </span>
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              type="text"
              value={qrInput}
              onChange={(e) => setQrInput(e.target.value)}
              placeholder="Pindai/ketik ID (mis. WB-2026-001)"
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-sm focus:border-blue-600 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
            >
              Catat Hadir
            </button>
          </div>
          {qrFeedback && (
            <p className="mt-1.5 text-xs font-medium text-blue-700">
              {qrFeedback}
            </p>
          )}
        </form>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">Hadir</p>
          <p className="mt-1 font-mono text-xl font-bold text-emerald-700 tabular-nums">
            {dailySummary.hadir}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">Izin</p>
          <p className="mt-1 font-mono text-xl font-bold text-blue-700 tabular-nums">
            {dailySummary.izin}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">Sakit</p>
          <p className="mt-1 font-mono text-xl font-bold text-amber-700 tabular-nums">
            {dailySummary.sakit}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">Alfa</p>
          <p className="mt-1 font-mono text-xl font-bold text-red-700 tabular-nums">
            {dailySummary.alfa}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs text-slate-500">Belum Dicatat</p>
          <p className="mt-1 font-mono text-xl font-bold text-slate-700 tabular-nums">
            {dailySummary.belum}
          </p>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <th className="px-6 py-3">Warga Belajar</th>
                <th className="px-4 py-3">Jalur SKK</th>
                <th className="px-4 py-3">Status Kehadiran ({selectedDate})</th>
                <th className="px-4 py-3">Jam & Sumber</th>
                <th className="px-6 py-3">Keterangan / Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleLearners.map((learner) => {
                const rec = recordsByLearner.get(learner.id);
                return (
                  <tr
                    key={learner.id}
                    className="transition-colors hover:bg-slate-50/70"
                  >
                    <td className="px-6 py-3.5">
                      <div className="font-medium text-slate-900">
                        {learner.nama}
                      </div>
                      <div className="font-mono text-xs text-slate-500 tabular-nums">
                        {learner.id} · {learner.program} ({learner.rombel})
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-700">
                      {rec?.modePembelajaran || selectedMode}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="inline-flex flex-wrap gap-1.5">
                        {STATUS_OPTIONS.map((opt) => {
                          const isActive = rec?.status === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleSetStatus(learner.id, opt.value)}
                              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                                isActive
                                  ? opt.activeClass
                                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              {opt.value === 'Hadir' && (
                                <Check className="h-3 w-3" />
                              )}
                              {opt.value === 'Izin' && (
                                <CalendarCheck className="h-3 w-3" />
                              )}
                              {opt.value === 'Sakit' && (
                                <AlertCircle className="h-3 w-3" />
                              )}
                              {opt.value === 'Alfa' && (
                                <XCircle className="h-3 w-3" />
                              )}
                              <span>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-600 tabular-nums">
                      {rec ? (
                        <div>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-400" />
                            {rec.waktuCatat}
                          </span>
                          <div className="text-[11px] text-slate-500">
                            {rec.pendingSync ? 'Antrean Offline' : rec.sumber || 'Manual'}
                          </div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <input
                        type="text"
                        value={rec?.catatan || ''}
                        onChange={(e) =>
                          handleNoteChange(learner.id, e.target.value)
                        }
                        placeholder="Catatan opsional..."
                        className="w-full min-w-[160px] rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
