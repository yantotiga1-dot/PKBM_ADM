import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Layers,
  Plus,
  X,
} from 'lucide-react';
import {
  AttendanceRecord,
  Institution,
  Learner,
  LearningModule,
  ProgramType,
  Quiz,
  QuizAttempt,
} from '../types';

interface ModuleManagerProps {
  institution: Institution;
  modules: LearningModule[];
  learners: Learner[];
  attendance: AttendanceRecord[];
  quizzes: Quiz[];
  attempts: QuizAttempt[];
  onAddModule: (mod: LearningModule) => void;
  onStartModuleQuiz: (quizId: string) => void;
}

export const ModuleManager: React.FC<ModuleManagerProps> = ({
  institution,
  modules,
  learners,
  attendance,
  quizzes,
  attempts,
  onAddModule,
  onStartModuleQuiz,
}) => {
  const [programFilter, setProgramFilter] = useState<string>('Semua');
  const [showAddModal, setShowAddModal] = useState(false);

  const [kode, setKode] = useState('');
  const [judul, setJudul] = useState('');
  const [program, setProgram] = useState<ProgramType>('Paket C');
  const [mataPelajaran, setMataPelajaran] = useState('');
  const [bobotSkk, setBobotSkk] = useState(3);
  const [targetNilai, setTargetNilai] = useState(75);
  const [deskripsi, setDeskripsi] = useState('');
  const [materiNama, setMateriNama] = useState('');
  const [materiDriveUrl, setMateriDriveUrl] = useState('');

  const filteredModules = useMemo(
    () =>
      modules.filter(
        (m) => programFilter === 'Semua' || m.program === programFilter
      ),
    [modules, programFilter]
  );

  // SKK Progress calculation per learner across Tatap Muka, Tutorial, Mandiri
  const learnerSkkRows = useMemo(() => {
    const weights = institution.skkWeights;
    return learners.map((learner) => {
      const lAtt = attendance.filter((a) => a.learnerId === learner.id);
      const lAt = attempts.filter((a) => a.learnerId === learner.id);

      const calcMode = (mode: AttendanceRecord['modePembelajaran']) => {
        const mAtt = lAtt.filter((a) => a.modePembelajaran === mode);
        const mPres = mAtt.filter((a) => a.status === 'Hadir').length;
        const attPct = mAtt.length > 0 ? (mPres / mAtt.length) * 100 : 100;
        const mQuiz = lAt.filter((a) => a.modePembelajaran === mode);
        const quizPct =
          mQuiz.length > 0
            ? mQuiz.reduce((s, q) => s + q.skor, 0) / mQuiz.length
            : lAt.length > 0
            ? lAt.reduce((s, q) => s + q.skor, 0) / lAt.length
            : 75;
        return Math.round(attPct * 0.35 + quizPct * 0.65);
      };

      const tm = calcMode('Tatap Muka');
      const tut = calcMode('Tutorial');
      const man = calcMode('Mandiri');
      const totalSkkScore = Math.round(
        (tm * weights.tatapMuka +
          tut * weights.tutorial +
          man * weights.mandiri) /
          100
      );

      const programModules = modules.filter(
        (m) => m.program === learner.program
      );
      const completedModules = programModules.filter((m) =>
        lAt.some((a) => a.moduleId === m.id && a.tuntas)
      ).length;

      return {
        learner,
        tm,
        tut,
        man,
        totalSkkScore,
        completedModules,
        totalModules: programModules.length,
      };
    });
  }, [learners, attendance, attempts, modules, institution.skkWeights]);

  const handleSubmitModule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!judul.trim() || !mataPelajaran.trim()) return;
    onAddModule({
      id: `MOD-${Date.now().toString().slice(-5)}`,
      institutionId: institution.id,
      kode: kode.trim() || `MOD-${modules.length + 1}`,
      judul: judul.trim(),
      program,
      mataPelajaran: mataPelajaran.trim(),
      bobotSkk,
      targetNilai,
      deskripsi: deskripsi.trim(),
      materiNama: materiNama.trim() || undefined,
      materiDriveUrl: materiDriveUrl.trim() || undefined,
    });
    setShowAddModal(false);
    setKode('');
    setJudul('');
    setMataPelajaran('');
    setDeskripsi('');
    setMateriNama('');
    setMateriDriveUrl('');
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Kurikulum Kesetaraan Self-Paced & Pembobotan SKK (Tatap Muka{' '}
            {institution.skkWeights.tatapMuka}% · Tutorial{' '}
            {institution.skkWeights.tutorial}% · Mandiri{' '}
            {institution.skkWeights.mandiri}%)
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Manajemen Pembelajaran Modular & SKK
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Modul Belajar</span>
        </button>
      </div>

      {/* Program Filter */}
      <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        {['Semua', 'Paket A', 'Paket B', 'Paket C', 'Kursus Vokasi'].map(
          (prog) => (
            <button
              key={prog}
              type="button"
              onClick={() => setProgramFilter(prog)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
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

      {/* Modules Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredModules.map((mod) => {
          const linkedQuizzes = quizzes.filter(
            (q) => q.moduleId === mod.id && !q.isRemedial
          );
          const moduleAttempts = attempts.filter((a) => a.moduleId === mod.id);
          const tuntasCount = moduleAttempts.filter((a) => a.tuntas).length;

          return (
            <div
              key={mod.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5"
            >
              <div>
                <div className="flex items-center justify-between font-mono text-xs text-slate-500 tabular-nums">
                  <span>
                    {mod.kode} · {mod.program}
                  </span>
                  <span className="font-semibold text-blue-700">
                    {mod.bobotSkk} SKK
                  </span>
                </div>
                <h3 className="mt-2 text-base font-bold text-slate-900">
                  {mod.judul}
                </h3>
                <p className="mt-1 text-xs font-medium text-slate-600">
                  {mod.mataPelajaran} · Target KKM {mod.targetNilai}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  {mod.deskripsi}
                </p>
              </div>

              <div className="mt-4 space-y-2.5 border-t border-slate-200 pt-3 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Ketuntasan Modul:</span>
                  <span className="font-mono font-semibold text-slate-900 tabular-nums">
                    {tuntasCount} / {moduleAttempts.length} selesai
                  </span>
                </div>

                {mod.materiNama && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 truncate text-slate-700">
                      <BookOpen className="h-3.5 w-3.5 shrink-0 text-blue-700" />
                      <span className="truncate">{mod.materiNama}</span>
                    </span>
                    {mod.materiDriveUrl && (
                      <a
                        href={mod.materiDriveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2 inline-flex items-center gap-1 font-medium text-blue-700 hover:underline shrink-0"
                      >
                        <span>Drive</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                )}

                {linkedQuizzes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onStartModuleQuiz(linkedQuizzes[0].id)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 text-center font-medium text-slate-800 hover:bg-slate-100"
                  >
                    Buka Evaluasi Modul ({linkedQuizzes[0].soal.length} Soal)
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* SKK Breakdown Table */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Rekapitulasi Nilai SKK per Jalur Pembelajaran & Progres Self-Paced
            </h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <th className="px-6 py-3">Warga Belajar</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3 text-right">
                  Tatap Muka ({institution.skkWeights.tatapMuka}%)
                </th>
                <th className="px-4 py-3 text-right">
                  Tutorial ({institution.skkWeights.tutorial}%)
                </th>
                <th className="px-4 py-3 text-right">
                  Mandiri ({institution.skkWeights.mandiri}%)
                </th>
                <th className="px-4 py-3 text-right">Nilai Akhir SKK</th>
                <th className="px-6 py-3 text-right">Modul Tuntas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {learnerSkkRows.map(
                ({
                  learner,
                  tm,
                  tut,
                  man,
                  totalSkkScore,
                  completedModules,
                  totalModules,
                }) => (
                  <tr key={learner.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3">
                      <p className="font-medium text-slate-900">{learner.nama}</p>
                      <p className="font-mono text-xs text-slate-500 tabular-nums">
                        {learner.id}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {learner.program}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-700 tabular-nums">
                      {tm}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-700 tabular-nums">
                      {tut}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-slate-700 tabular-nums">
                      {man}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-bold tabular-nums">
                      <span
                        className={
                          totalSkkScore >= learner.targetKompetensi
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }
                      >
                        {totalSkkScore}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-xs tabular-nums">
                      <span className="inline-flex items-center gap-1 text-slate-800">
                        <CheckCircle2 className="h-3.5 w-3.5 text-blue-700" />
                        {completedModules} / {totalModules} modul
                      </span>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Module Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Tambah Modul Pembelajaran Baru
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitModule} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Kode Modul
                  </label>
                  <input
                    type="text"
                    required
                    value={kode}
                    onChange={(e) => setKode(e.target.value)}
                    placeholder="PKC-EKO-02"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Program
                  </label>
                  <select
                    value={program}
                    onChange={(e) => setProgram(e.target.value as ProgramType)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="Paket A">Paket A</option>
                    <option value="Paket B">Paket B</option>
                    <option value="Paket C">Paket C</option>
                    <option value="Kursus Vokasi">Kursus Vokasi</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Judul Modul
                </label>
                <input
                  type="text"
                  required
                  value={judul}
                  onChange={(e) => setJudul(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Bobot SKK
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={bobotSkk}
                    onChange={(e) => setBobotSkk(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Target KKM
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={100}
                    value={targetNilai}
                    onChange={(e) => setTargetNilai(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Mapel
                  </label>
                  <input
                    type="text"
                    required
                    value={mataPelajaran}
                    onChange={(e) => setMataPelajaran(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Deskripsi Singkat
                </label>
                <textarea
                  rows={2}
                  value={deskripsi}
                  onChange={(e) => setDeskripsi(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Nama File Materi (Opsional)
                  </label>
                  <input
                    type="text"
                    value={materiNama}
                    onChange={(e) => setMateriNama(e.target.value)}
                    placeholder="Modul_Ekonomi.pdf"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Tautan Google Drive Materi
                  </label>
                  <input
                    type="url"
                    value={materiDriveUrl}
                    onChange={(e) => setMateriDriveUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
                >
                  Simpan Modul
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
