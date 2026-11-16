import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CalendarPlus,
  CheckCircle2,
  Clock,
  ExternalLink,
  KeyRound,
  LogOut,
  Play,
  QrCode,
} from 'lucide-react';
import {
  AttendanceRecord,
  Institution,
  Learner,
  LearnerDocument,
  LearningModule,
  LeaveRequest,
  Quiz,
  QuizAttempt,
} from '../types';

interface LearnerPortalProps {
  institution: Institution;
  learners: Learner[];
  modules: LearningModule[];
  documents: LearnerDocument[];
  attendance: AttendanceRecord[];
  quizzes: Quiz[];
  attempts: QuizAttempt[];
  leaveRequests: LeaveRequest[];
  onSubmitLeaveRequest: (req: LeaveRequest) => void;
  onStartQuizAsLearner: (learnerId: string, quizId: string) => void;
}

export const LearnerPortal: React.FC<LearnerPortalProps> = ({
  institution,
  learners,
  modules,
  documents,
  attendance,
  quizzes,
  attempts,
  leaveRequests,
  onSubmitLeaveRequest,
  onStartQuizAsLearner,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggedInLearnerId, setLoggedInLearnerId] = useState<string | null>(
    null
  );

  // Leave request form state
  const [leaveDate, setLeaveDate] = useState('2026-11-16');
  const [leaveType, setLeaveType] = useState<'Izin' | 'Sakit'>('Izin');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveSentMsg, setLeaveSentMsg] = useState<string | null>(null);

  const activeLearner = useMemo(
    () => learners.find((l) => l.id === loggedInLearnerId) || null,
    [learners, loggedInLearnerId]
  );

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    let cleaned = identifier.trim();
    if (cleaned.includes('verify=')) {
      const m = cleaned.match(/verify=([^&\s]+)/);
      if (m) cleaned = m[1];
    }

    const found = learners.find(
      (l) =>
        l.id.toLowerCase() === cleaned.toLowerCase() ||
        l.nisn.toLowerCase() === cleaned.toLowerCase()
    );
    if (!found) {
      setLoginError('ID Warga Belajar atau NISN tidak ditemukan di lembaga ini.');
      return;
    }
    if (found.pin !== pinInput.trim()) {
      setLoginError('PIN tidak sesuai. Periksa kartu atau hubungi tutor Anda.');
      return;
    }
    setLoggedInLearnerId(found.id);
  };

  const portalData = useMemo(() => {
    if (!activeLearner) return null;
    const myAtt = attendance.filter((a) => a.learnerId === activeLearner.id);
    const hadir = myAtt.filter((a) => a.status === 'Hadir').length;
    const attRate =
      myAtt.length > 0 ? Math.round((hadir / myAtt.length) * 100) : 100;

    const myAttempts = attempts
      .filter((a) => a.learnerId === activeLearner.id)
      .sort((a, b) => b.tanggalPengerjaan.localeCompare(a.tanggalPengerjaan));

    const myModules = modules.filter((m) => m.program === activeLearner.program);
    const myDocs = documents.filter(
      (d) =>
        d.learnerId === activeLearner.id || d.kategori === 'Materi Belajar'
    );
    const myQuizzes = quizzes.filter(
      (q) =>
        (q.program === 'Semua Program' || q.program === activeLearner.program) &&
        (!q.assignedLearnerIds || q.assignedLearnerIds.includes(activeLearner.id))
    );
    const myRemedials = myQuizzes.filter((q) => q.isRemedial);
    const myLeaveRequests = leaveRequests
      .filter((lr) => lr.learnerId === activeLearner.id)
      .sort((a, b) => b.waktuAjukan.localeCompare(a.waktuAjukan));

    return {
      attRate,
      hadir,
      totalAtt: myAtt.length,
      myAttempts,
      myModules,
      myDocs,
      myQuizzes,
      myRemedials,
      myLeaveRequests,
    };
  }, [
    activeLearner,
    attendance,
    attempts,
    modules,
    documents,
    quizzes,
    leaveRequests,
  ]);

  const handleLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLearner || !leaveReason.trim()) return;
    onSubmitLeaveRequest({
      id: `IZN-${Date.now().toString().slice(-5)}`,
      institutionId: activeLearner.institutionId,
      learnerId: activeLearner.id,
      learnerNama: activeLearner.nama,
      tanggal: leaveDate,
      jenis: leaveType,
      alasan: leaveReason.trim(),
      waktuAjukan: new Date().toISOString(),
      status: 'Menunggu',
    });
    setLeaveReason('');
    setLeaveSentMsg('Pengajuan izin berhasil dikirim ke tutor & daftar presensi.');
  };

  if (!activeLearner || !portalData) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-4">
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
            <QrCode className="h-4 w-4" />
            <span>{institution.nama} · Akses Mandiri Peserta Didik</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">
            Portal Mandiri Warga Belajar
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Masuk menggunakan ID Kartu QR atau NISN beserta PIN 4 digit untuk melihat nilai, mengunduh materi Drive, mengerjakan remidial, dan mengajukan izin.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                ID Kartu / NISN / Tautan QR
              </label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Contoh: WB-2026-004 atau 0115509834"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3.5 py-2.5 font-mono text-sm focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">
                PIN Akses (4 Digit)
              </label>
              <div className="relative mt-1">
                <KeyRound className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  required
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="••••"
                  className="w-full rounded-lg border border-slate-200 py-2.5 pr-3.5 pl-10 font-mono text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            {loginError && (
              <p className="text-xs font-medium text-red-700">{loginError}</p>
            )}

            <button
              type="submit"
              className="w-full rounded-lg bg-blue-700 py-2.5 text-sm font-medium text-white hover:bg-blue-800"
            >
              Masuk ke Portal Saya
            </button>
          </form>

          {/* Quick Demo Access for Evaluation */}
          <div className="mt-6 border-t border-slate-200 pt-4">
            <p className="text-xs font-semibold text-slate-600">
              Akses Cepat Uji Coba Warga Belajar ({institution.nama}):
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {learners.slice(0, 4).map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    setIdentifier(l.id);
                    setPinInput(l.pin);
                    setLoggedInLearnerId(l.id);
                  }}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-xs hover:bg-slate-100"
                >
                  <span className="font-semibold text-slate-900">{l.nama}</span>
                  <span className="ml-1.5 font-mono text-[11px] text-slate-500">
                    ({l.id} · PIN {l.pin})
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Logged-in Header */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-xs text-slate-500 tabular-nums">
            {activeLearner.id} · NISN {activeLearner.nisn} ·{' '}
            {activeLearner.program} ({activeLearner.rombel})
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            Selamat Datang, {activeLearner.nama}
          </h1>
          <p className="mt-0.5 text-xs text-slate-600">
            Tutor Pembimbing: {activeLearner.tutorNama}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setLoggedInLearnerId(null)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Keluar Portal</span>
        </button>
      </div>

      {/* In-App Remedial Alert Banner (Addresses low Gmail open rate) */}
      {portalData.myRemedials.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <h2 className="text-sm font-bold text-amber-950">
                  Tugas Remidial Otomatis Tersedia ({portalData.myRemedials.length})
                </h2>
                <p className="mt-0.5 text-xs text-amber-900">
                  Sistem mendeteksi capaian evaluasi sebelumnya di bawah KKM dan menerbitkan soal remidial khusus untuk Anda selesaikan.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onStartQuizAsLearner(
                  activeLearner.id,
                  portalData.myRemedials[0].id
                )
              }
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-700 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-800 whitespace-nowrap shrink-0"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Kerjakan Remidial Sekarang</span>
            </button>
          </div>
        </div>
      )}

      {/* Personal Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">Kehadiran Saya</p>
          <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {portalData.attRate}%
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {portalData.hadir} dari {portalData.totalAtt} pertemuan
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">Evaluasi Diselesaikan</p>
          <p className="mt-1 font-mono text-2xl font-bold text-blue-700 tabular-nums">
            {portalData.myAttempts.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Target KKM pribadi: {activeLearner.targetKompetensi} poin
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-500">Modul Program Tersedia</p>
          <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
            {portalData.myModules.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Pembelajaran mandiri berbasis modul
          </p>
        </div>
      </div>

      {/* Main Grid: Available Quizzes + Drive Materials + Leave Request */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Quizzes & Attempt History */}
        <div className="space-y-6 lg:col-span-7">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">
              Evaluasi & Soal Remidial Saya
            </h2>
            <div className="mt-4 divide-y divide-slate-200">
              {portalData.myQuizzes.map((q) => (
                <div
                  key={q.id}
                  className="flex flex-col justify-between gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-sm">
                        {q.judul}
                      </span>
                      {q.isRemedial && (
                        <span className="text-[11px] font-semibold text-red-700">
                          [Remidial]
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {q.mataPelajaran} · {q.modePembelajaran} · {q.soal.length}{' '}
                      soal · KKM {q.targetNilai}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onStartQuizAsLearner(activeLearner.id, q.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>Kerjakan</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">
              Riwayat Nilai Evaluasi Saya
            </h2>
            {portalData.myAttempts.length === 0 ? (
              <p className="mt-3 text-xs text-slate-500">
                Belum ada riwayat evaluasi yang dikerjakan.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-slate-200">
                {portalData.myAttempts.map((at) => (
                  <div
                    key={at.id}
                    className="flex items-center justify-between py-3 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {at.quizJudul}
                      </p>
                      <p className="mt-0.5 text-slate-500 font-mono tabular-nums">
                        {at.tanggalPengerjaan.slice(0, 10)} ·{' '}
                        <Clock className="inline h-3 w-3" />{' '}
                        {Math.floor(at.totalDurasiDetik / 60)}m{' '}
                        {at.totalDurasiDetik % 60}d
                      </p>
                    </div>
                    <div className="text-right font-mono tabular-nums">
                      <span
                        className={`text-sm font-bold ${
                          at.tuntas ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {at.skor}
                      </span>
                      <span className="text-slate-400">/{at.targetNilai}</span>
                      <div className="text-[11px]">
                        {at.tuntas ? (
                          <span className="text-emerald-700">
                            <CheckCircle2 className="mr-0.5 inline h-3 w-3" />
                            Tuntas
                          </span>
                        ) : (
                          <span className="text-red-700">Perlu Remidial</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Materi Google Drive & Pengajuan Izin Mandiri */}
        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">
              Materi Modul & Arsip Google Drive
            </h2>
            <div className="mt-3 space-y-2.5 text-xs">
              {portalData.myModules.map((mod) => (
                <div
                  key={mod.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 p-3"
                >
                  <div className="min-w-0 pr-2">
                    <p className="font-semibold text-slate-900 truncate">
                      {mod.judul}
                    </p>
                    <p className="text-slate-500">
                      {mod.bobotSkk} SKK · {mod.materiNama || 'Materi Modul'}
                    </p>
                  </div>
                  {mod.materiDriveUrl && (
                    <a
                      href={mod.materiDriveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline shrink-0"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      <span>Unduh</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2">
              <CalendarPlus className="h-4 w-4 text-blue-700" />
              <h2 className="text-base font-semibold text-slate-900">
                Pengajuan Izin / Sakit Mandiri
              </h2>
            </div>

            <form onSubmit={handleLeaveSubmit} className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Tanggal
                  </label>
                  <input
                    type="date"
                    required
                    value={leaveDate}
                    onChange={(e) => setLeaveDate(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Jenis
                  </label>
                  <select
                    value={leaveType}
                    onChange={(e) =>
                      setLeaveType(e.target.value as 'Izin' | 'Sakit')
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                  >
                    <option value="Izin">Izin</option>
                    <option value="Sakit">Sakit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Alasan Singkat
                </label>
                <textarea
                  rows={2}
                  required
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="Tuliskan keterangan izin atau sakit..."
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
              </div>

              {leaveSentMsg && (
                <p className="text-xs font-medium text-emerald-700">
                  {leaveSentMsg}
                </p>
              )}

              <button
                type="submit"
                className="w-full rounded-lg bg-slate-900 py-2 text-xs font-medium text-white hover:bg-slate-800"
              >
                Kirim Pengajuan Izin
              </button>
            </form>

            {portalData.myLeaveRequests.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-xs">
                <p className="font-semibold text-slate-700">
                  Riwayat Pengajuan Saya:
                </p>
                {portalData.myLeaveRequests.map((lr) => (
                  <div
                    key={lr.id}
                    className="flex items-center justify-between rounded border border-slate-200 px-3 py-2"
                  >
                    <div>
                      <span className="font-mono font-semibold text-slate-800">
                        {lr.tanggal}
                      </span>{' '}
                      · {lr.jenis}
                    </div>
                    <span
                      className={
                        lr.status === 'Disetujui'
                          ? 'font-semibold text-emerald-700'
                          : lr.status === 'Ditolak'
                          ? 'font-semibold text-red-700'
                          : 'font-semibold text-amber-700'
                      }
                    >
                      {lr.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
