import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  Eye,
  FileText,
  Plus,
  QrCode,
  Search,
  Trash2,
  User,
  X,
} from 'lucide-react';
import {
  AttendanceRecord,
  Learner,
  LearnerDocument,
  LearnerStatus,
  ProgramType,
  QuizAttempt,
} from '../types';

interface LearnerManagementProps {
  institutionId: string;
  learners: Learner[];
  documents: LearnerDocument[];
  attendance: AttendanceRecord[];
  attempts: QuizAttempt[];
  selectedLearnerId: string | null;
  onSelectLearnerId: (id: string | null) => void;
  onAddLearner: (learner: Learner) => void;
  onUpdateLearner: (learner: Learner) => void;
  onDeleteLearner: (id: string) => void;
  onOpenCard: (learnerId: string) => void;
}

const PROGRAMS: ProgramType[] = ['Paket A', 'Paket B', 'Paket C', 'Kursus Vokasi'];
const STATUSES: LearnerStatus[] = ['Aktif', 'Cuti', 'Lulus'];

export const LearnerManagement: React.FC<LearnerManagementProps> = ({
  institutionId,
  learners,
  documents,
  attendance,
  attempts,
  selectedLearnerId,
  onSelectLearnerId,
  onAddLearner,
  onUpdateLearner,
  onDeleteLearner,
  onOpenCard,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [programFilter, setProgramFilter] = useState<string>('Semua');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLearner, setEditingLearner] = useState<Learner | null>(null);

  const [formState, setFormState] = useState<Omit<Learner, 'id'>>({
    institutionId,
    nisn: '',
    pin: '1234',
    nama: '',
    program: 'Paket C',
    rombel: 'XII-IPS-1',
    tutorNama: 'Drs. Hendra Kusuma, M.Pd.',
    tutorEmail: 'hendra.kusuma@lenterabelajar.sch.id',
    targetKompetensi: 75,
    status: 'Aktif',
    telepon: '',
    alamat: '',
    tanggalBergabung: new Date().toISOString().slice(0, 10),
  });

  const filteredLearners = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return learners.filter((l) => {
      const matchProg = programFilter === 'Semua' || l.program === programFilter;
      const matchQuery =
        !q ||
        l.nama.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q) ||
        l.nisn.toLowerCase().includes(q) ||
        l.rombel.toLowerCase().includes(q);
      return matchProg && matchQuery;
    });
  }, [learners, searchQuery, programFilter]);

  const inspectedLearner = useMemo(
    () => learners.find((l) => l.id === selectedLearnerId) || null,
    [learners, selectedLearnerId]
  );

  const inspectedStats = useMemo(() => {
    if (!inspectedLearner) return null;
    const lAtt = attendance.filter((a) => a.learnerId === inspectedLearner.id);
    const hadir = lAtt.filter((a) => a.status === 'Hadir').length;
    const izin = lAtt.filter((a) => a.status === 'Izin').length;
    const sakit = lAtt.filter((a) => a.status === 'Sakit').length;
    const alfa = lAtt.filter((a) => a.status === 'Alfa').length;
    const rate = lAtt.length > 0 ? Math.round((hadir / lAtt.length) * 100) : 100;

    const lAttempts = attempts
      .filter((at) => at.learnerId === inspectedLearner.id)
      .sort((a, b) => b.tanggalPengerjaan.localeCompare(a.tanggalPengerjaan));

    const lDocs = documents.filter((d) => d.learnerId === inspectedLearner.id);

    return { hadir, izin, sakit, alfa, rate, lAttempts, lDocs };
  }, [inspectedLearner, attendance, attempts, documents]);

  const openAddModal = () => {
    setEditingLearner(null);
    setFormState({
      institutionId,
      nisn: '',
      pin: String(1000 + Math.floor(Math.random() * 8999)),
      nama: '',
      program: 'Paket C',
      rombel: 'XII-IPS-1',
      tutorNama: 'Drs. Hendra Kusuma, M.Pd.',
      tutorEmail: 'hendra.kusuma@lenterabelajar.sch.id',
      targetKompetensi: 75,
      status: 'Aktif',
      telepon: '',
      alamat: '',
      tanggalBergabung: new Date().toISOString().slice(0, 10),
    });
    setIsModalOpen(true);
  };

  const openEditModal = (learner: Learner) => {
    setEditingLearner(learner);
    setFormState({
      institutionId: learner.institutionId,
      nisn: learner.nisn,
      pin: learner.pin,
      nama: learner.nama,
      program: learner.program,
      rombel: learner.rombel,
      tutorNama: learner.tutorNama,
      tutorEmail: learner.tutorEmail,
      targetKompetensi: learner.targetKompetensi,
      status: learner.status,
      telepon: learner.telepon,
      alamat: learner.alamat,
      tanggalBergabung: learner.tanggalBergabung,
      fotoUrl: learner.fotoUrl,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.nama.trim()) return;
    if (editingLearner) {
      onUpdateLearner({
        ...editingLearner,
        ...formState,
      });
    } else {
      const nextNum = String(Date.now()).slice(-4);
      onAddLearner({
        id: `WB-2026-${nextNum}`,
        ...formState,
        institutionId,
      });
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Direktori Induk & Profil Riwayat Belajar
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Data Warga Belajar
          </h1>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Warga Belajar</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama, ID, NISN, atau rombel..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {['Semua', ...PROGRAMS].map((prog) => (
            <button
              key={prog}
              type="button"
              onClick={() => setProgramFilter(prog)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                programFilter === prog
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {prog}
            </button>
          ))}
        </div>
      </div>

      {/* Learners Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <th className="px-6 py-3">Warga Belajar</th>
                <th className="px-4 py-3">Program & Rombel</th>
                <th className="px-4 py-3">Tutor Pembimbing</th>
                <th className="px-4 py-3 text-right">Target KKM</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-6 py-3 text-right">Kelola</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredLearners.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-sm text-slate-500"
                  >
                    Tidak ada warga belajar yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                filteredLearners.map((learner) => (
                  <tr
                    key={learner.id}
                    className="transition-colors hover:bg-slate-50/70"
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        {learner.fotoUrl ? (
                          <img
                            src={learner.fotoUrl}
                            alt={learner.nama}
                            referrerPolicy="no-referrer"
                            className="h-10 w-10 rounded-lg border border-slate-200 object-cover shrink-0"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-600">
                            {learner.nama
                              .split(' ')
                              .slice(0, 2)
                              .map((n) => n[0])
                              .join('')}
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-slate-900">
                            {learner.nama}
                          </div>
                          <div className="font-mono text-xs text-slate-500 tabular-nums">
                            {learner.id} · NISN {learner.nisn} · PIN {learner.pin}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      <div className="font-medium text-slate-800">
                        {learner.program}
                      </div>
                      <div>{learner.rombel}</div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      <div className="font-medium text-slate-800">
                        {learner.tutorNama}
                      </div>
                      <div className="text-slate-500">{learner.tutorEmail}</div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-slate-800 tabular-nums">
                      {learner.targetKompetensi}
                    </td>
                    <td className="px-4 py-3.5 text-xs font-medium">
                      <span
                        className={
                          learner.status === 'Aktif'
                            ? 'text-emerald-700'
                            : learner.status === 'Lulus'
                            ? 'text-blue-700'
                            : 'text-amber-700'
                        }
                      >
                        {learner.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onSelectLearnerId(learner.id)}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          <Eye className="mr-1 inline h-3.5 w-3.5" />
                          Riwayat
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenCard(learner.id)}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                        >
                          <QrCode className="mr-1 inline h-3.5 w-3.5" />
                          Kartu
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(learner)}
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                          aria-label={`Ubah data ${learner.nama}`}
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteLearner(learner.id)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Hapus ${learner.nama}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Detail Profile & Riwayat Belajar */}
      {inspectedLearner && inspectedStats && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-slate-900/40 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex h-full w-full max-w-2xl flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div className="flex items-center gap-4">
                {inspectedLearner.fotoUrl ? (
                  <img
                    src={inspectedLearner.fotoUrl}
                    alt={inspectedLearner.nama}
                    referrerPolicy="no-referrer"
                    className="h-14 w-14 rounded-xl border border-slate-200 object-cover"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-600">
                    <User className="h-6 w-6" />
                  </div>
                )}
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {inspectedLearner.nama}
                  </h2>
                  <p className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums">
                    {inspectedLearner.id} · NISN {inspectedLearner.nisn} ·{' '}
                    {inspectedLearner.program} ({inspectedLearner.rombel})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSelectLearnerId(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Tutup panel riwayat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-6">
              {/* Attendance & Target summary */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Kehadiran</p>
                  <p className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
                    {inspectedStats.rate}%
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Hadir / Izin / Alfa</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-slate-800 tabular-nums">
                    {inspectedStats.hadir} / {inspectedStats.izin + inspectedStats.sakit} /{' '}
                    {inspectedStats.alfa}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Target KKM</p>
                  <p className="mt-1 font-mono text-xl font-semibold text-blue-700 tabular-nums">
                    {inspectedLearner.targetKompetensi}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Dokumen Terkait</p>
                  <p className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
                    {inspectedStats.lDocs.length}
                  </p>
                </div>
              </div>

              {/* Biodata & Tutor */}
              <div className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-5 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-slate-500">Tutor Pembimbing</p>
                  <p className="mt-0.5 font-medium text-slate-900">
                    {inspectedLearner.tutorNama}
                  </p>
                  <p className="text-xs text-slate-500">
                    {inspectedLearner.tutorEmail}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Kontak & Alamat</p>
                  <p className="mt-0.5 font-mono text-xs text-slate-800 tabular-nums">
                    {inspectedLearner.telepon || '-'}
                  </p>
                  <p className="text-xs text-slate-600">
                    {inspectedLearner.alamat || '-'}
                  </p>
                </div>
              </div>

              {/* Quiz History */}
              <div className="border-t border-slate-200 pt-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  Riwayat Pengerjaan Soal & Kompetensi
                </h3>
                {inspectedStats.lAttempts.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Belum ada riwayat pengerjaan evaluasi soal.
                  </p>
                ) : (
                  <div className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200">
                    {inspectedStats.lAttempts.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center justify-between gap-4 px-4 py-3 text-xs"
                      >
                        <div>
                          <p className="font-medium text-slate-900">
                            {att.quizJudul}
                          </p>
                          <p className="mt-0.5 text-slate-500">
                            {att.mataPelajaran} ·{' '}
                            {att.tanggalPengerjaan.slice(0, 10)} · Durasi{' '}
                            <span className="font-mono tabular-nums">
                              {Math.floor(att.totalDurasiDetik / 60)}m{' '}
                              {att.totalDurasiDetik % 60}d
                            </span>
                          </p>
                        </div>
                        <div className="text-right font-mono tabular-nums">
                          <span
                            className={`text-sm font-bold ${
                              att.tuntas ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {att.skor}
                          </span>
                          <span className="text-slate-400">
                            /{att.targetNilai}
                          </span>
                          <div className="mt-0.5 flex items-center justify-end gap-1 text-[11px]">
                            {att.tuntas ? (
                              <span className="text-emerald-700">
                                <CheckCircle2 className="mr-0.5 inline h-3 w-3" />
                                Tuntas
                              </span>
                            ) : (
                              <span className="text-red-700">Remedial</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Documents */}
              <div className="border-t border-slate-200 pt-5">
                <h3 className="text-sm font-semibold text-slate-900">
                  Arsip Dokumen Terkait
                </h3>
                {inspectedStats.lDocs.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">
                    Belum ada dokumen yang diunggah untuk warga belajar ini.
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {inspectedStats.lDocs.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <FileText className="h-4 w-4 text-blue-700" />
                          <div>
                            <p className="font-medium text-slate-900">
                              {doc.namaFile}
                            </p>
                            <p className="text-slate-500">
                              {doc.kategori} · {doc.ukuranLabel} ·{' '}
                              {doc.statusSinkron}
                            </p>
                          </div>
                        </div>
                        {doc.driveWebViewLink && (
                          <a
                            href={doc.driveWebViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-blue-700 hover:underline"
                          >
                            Buka di Drive
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    onSelectLearnerId(null);
                    onOpenCard(inspectedLearner.id);
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
                >
                  <QrCode className="h-4 w-4" />
                  <span>Cetak Kartu QR</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h2 className="text-lg font-bold text-slate-900">
                {editingLearner
                  ? 'Perbarui Data Warga Belajar'
                  : 'Tambah Warga Belajar Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.nama}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, nama: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    NISN / Nomor Induk
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.nisn}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, nisn: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Program Belajar
                  </label>
                  <select
                    value={formState.program}
                    onChange={(e) =>
                      setFormState((s) => ({
                        ...s,
                        program: e.target.value as ProgramType,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    {PROGRAMS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Rombongan Belajar
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.rombel}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, rombel: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Nama Tutor Pembimbing
                  </label>
                  <input
                    type="text"
                    required
                    value={formState.tutorNama}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, tutorNama: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Email Tutor (Untuk Notifikasi)
                  </label>
                  <input
                    type="email"
                    required
                    value={formState.tutorEmail}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, tutorEmail: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Target Kompetensi (KKM)
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={100}
                    value={formState.targetKompetensi}
                    onChange={(e) =>
                      setFormState((s) => ({
                        ...s,
                        targetKompetensi: Number(e.target.value),
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Status Keaktifan
                  </label>
                  <select
                    value={formState.status}
                    onChange={(e) =>
                      setFormState((s) => ({
                        ...s,
                        status: e.target.value as LearnerStatus,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  >
                    {STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Nomor Telepon / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={formState.telepon}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, telepon: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Tanggal Bergabung
                  </label>
                  <input
                    type="date"
                    value={formState.tanggalBergabung}
                    onChange={(e) =>
                      setFormState((s) => ({
                        ...s,
                        tanggalBergabung: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    PIN Portal Warga Belajar (4 Digit)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={formState.pin}
                    onChange={(e) =>
                      setFormState((s) => ({ ...s, pin: e.target.value }))
                    }
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Alamat Domisili
                  </label>
                <input
                  type="text"
                  value={formState.alamat}
                  onChange={(e) =>
                    setFormState((s) => ({ ...s, alamat: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
                >
                  {editingLearner ? 'Simpan Perubahan' : 'Simpan Warga Belajar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
