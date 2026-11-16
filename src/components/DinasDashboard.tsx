import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  Search,
  ShieldAlert,
  Users,
} from 'lucide-react';
import {
  AttendanceRecord,
  Institution,
  Learner,
  LearningModule,
  QuizAttempt,
  TutorNotification,
} from '../types';

interface DinasDashboardProps {
  institutions: Institution[];
  learners: Learner[];
  attendance: AttendanceRecord[];
  attempts: QuizAttempt[];
  modules: LearningModule[];
  notifications: TutorNotification[];
  onSwitchInstitution: (institutionId: string) => void;
}

export const DinasDashboard: React.FC<DinasDashboardProps> = ({
  institutions,
  learners,
  attendance,
  attempts,
  notifications,
  onSwitchInstitution,
}) => {
  const [selectedInstFilter, setSelectedInstFilter] = useState<string>('Semua');
  const [searchLearner, setSearchLearner] = useState('');

  const institutionSummaries = useMemo(() => {
    return institutions.map((inst) => {
      const instLearners = learners.filter((l) => l.institutionId === inst.id);
      const instAtt = attendance.filter((a) => a.institutionId === inst.id);
      const present = instAtt.filter((a) => a.status === 'Hadir').length;
      const attRate =
        instAtt.length > 0 ? Math.round((present / instAtt.length) * 100) : 100;

      const instAttempts = attempts.filter((at) => at.institutionId === inst.id);
      const avgScore =
        instAttempts.length > 0
          ? Math.round(
              instAttempts.reduce((s, a) => s + a.skor, 0) / instAttempts.length
            )
          : 0;
      const passRate =
        instAttempts.length > 0
          ? Math.round(
              (instAttempts.filter((a) => a.tuntas).length /
                instAttempts.length) *
                100
            )
          : 0;

      // EWS High Risk learners inside this institution
      let highRiskCount = 0;
      for (const l of instLearners) {
        const lAtt = instAtt.filter((a) => a.learnerId === l.id);
        const lPresent = lAtt.filter((a) => a.status === 'Hadir').length;
        const lAttRate =
          lAtt.length > 0 ? Math.round((lPresent / lAtt.length) * 100) : 100;
        const lAt = instAttempts.filter((a) => a.learnerId === l.id);
        const lAvg =
          lAt.length > 0
            ? Math.round(lAt.reduce((s, a) => s + a.skor, 0) / lAt.length)
            : null;
        if (
          (lAttRate < 75 && lAvg !== null && lAvg < l.targetKompetensi) ||
          lAttRate < 70 ||
          (lAvg !== null && lAvg < l.targetKompetensi - 15)
        ) {
          highRiskCount++;
        }
      }

      const pendingNotifs = notifications.filter(
        (n) =>
          n.institutionId === inst.id && n.statusKirim === 'Menunggu Tindakan'
      ).length;

      return {
        inst,
        learnerCount: instLearners.length,
        attRate,
        avgScore,
        passRate,
        highRiskCount,
        pendingNotifs,
      };
    });
  }, [institutions, learners, attendance, attempts, notifications]);

  const globalTotals = useMemo(() => {
    const totalLearners = learners.length;
    const totalPresent = attendance.filter((a) => a.status === 'Hadir').length;
    const avgAtt =
      attendance.length > 0
        ? Math.round((totalPresent / attendance.length) * 100)
        : 100;
    const avgPass =
      attempts.length > 0
        ? Math.round(
            (attempts.filter((a) => a.tuntas).length / attempts.length) * 100
          )
        : 0;
    const totalHighRisk = institutionSummaries.reduce(
      (s, i) => s + i.highRiskCount,
      0
    );
    return { totalLearners, avgAtt, avgPass, totalHighRisk };
  }, [learners, attendance, attempts, institutionSummaries]);

  const crossInstitutionLearners = useMemo(() => {
    const q = searchLearner.trim().toLowerCase();
    return learners
      .filter(
        (l) =>
          (selectedInstFilter === 'Semua' ||
            l.institutionId === selectedInstFilter) &&
          (!q ||
            l.nama.toLowerCase().includes(q) ||
            l.nisn.toLowerCase().includes(q) ||
            l.program.toLowerCase().includes(q))
      )
      .map((l) => {
        const inst = institutions.find((i) => i.id === l.institutionId);
        const lAtt = attendance.filter((a) => a.learnerId === l.id);
        const hadir = lAtt.filter((a) => a.status === 'Hadir').length;
        const attRate =
          lAtt.length > 0 ? Math.round((hadir / lAtt.length) * 100) : 100;
        const lAt = attempts.filter((a) => a.learnerId === l.id);
        const avgScore =
          lAt.length > 0
            ? Math.round(lAt.reduce((s, a) => s + a.skor, 0) / lAt.length)
            : null;

        // Weighted SKK Attainment
        const weights = inst?.skkWeights || {
          tatapMuka: 40,
          tutorial: 30,
          mandiri: 30,
        };
        const modeScore = (mode: AttendanceRecord['modePembelajaran']) => {
          const modeAtt = lAtt.filter((a) => a.modePembelajaran === mode);
          const modePres = modeAtt.filter((a) => a.status === 'Hadir').length;
          const mAttPct =
            modeAtt.length > 0 ? (modePres / modeAtt.length) * 100 : 100;
          const modeQuiz = lAt.filter((a) => a.modePembelajaran === mode);
          const mQuizPct =
            modeQuiz.length > 0
              ? modeQuiz.reduce((s, x) => s + x.skor, 0) / modeQuiz.length
              : avgScore ?? 75;
          return Math.round(mAttPct * 0.4 + mQuizPct * 0.6);
        };

        const weightedSkkScore = Math.round(
          (modeScore('Tatap Muka') * weights.tatapMuka +
            modeScore('Tutorial') * weights.tutorial +
            modeScore('Mandiri') * weights.mandiri) /
            100
        );

        const isDropOutRisk =
          (attRate < 75 && avgScore !== null && avgScore < l.targetKompetensi) ||
          attRate < 70 ||
          (avgScore !== null && avgScore < l.targetKompetensi - 15);
        const isWarning =
          !isDropOutRisk &&
          (attRate < 80 ||
            (avgScore !== null && avgScore < l.targetKompetensi));

        return {
          learner: l,
          instName: inst?.nama || l.institutionId,
          attRate,
          avgScore,
          weightedSkkScore,
          isDropOutRisk,
          isWarning,
        };
      });
  }, [
    learners,
    institutions,
    attendance,
    attempts,
    selectedInstFilter,
    searchLearner,
  ]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Pemantauan Lintas Lembaga Pendidikan Kesetaraan & Vokasi (Dinas Pendidikan)
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Dasbor Eksekutif Dinas Pendidikan
          </h1>
        </div>
        <div className="font-mono text-xs text-slate-500 tabular-nums">
          Total Lembaga Terdaftar: {institutions.length} PKBM / LKP
        </div>
      </div>

      {/* Global 4 KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Lembaga Terpantau</span>
            <Building2 className="h-4 w-4 text-blue-700" />
          </div>
          <p className="mt-2 font-mono text-3xl font-bold text-slate-900 tabular-nums">
            {institutions.length}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            Integrasi spreadsheet terpisah per lembaga
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Warga Belajar</span>
            <Users className="h-4 w-4 text-blue-700" />
          </div>
          <p className="mt-2 font-mono text-3xl font-bold text-slate-900 tabular-nums">
            {globalTotals.totalLearners}
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            Lintas Paket A, Paket B, Paket C & Vokasi
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Kehadiran & Ketuntasan Global</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          </div>
          <p className="mt-2 font-mono text-3xl font-bold text-slate-900 tabular-nums">
            {globalTotals.avgAtt}%{' '}
            <span className="text-base font-normal text-slate-400">
              / {globalTotals.avgPass}% tuntas
            </span>
          </p>
          <p className="mt-1.5 text-xs text-slate-500">
            Agregasi presensi harian dan evaluasi modul
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Risiko Drop-Out (EWS)</span>
            <ShieldAlert className="h-4 w-4 text-red-600" />
          </div>
          <p className="mt-2 font-mono text-3xl font-bold text-red-700 tabular-nums">
            {globalTotals.totalHighRisk}
          </p>
          <p className="mt-1.5 text-xs text-slate-600">
            Siswa dengan kehadiran rendah & nilai &lt; KKM
          </p>
        </div>
      </div>

      {/* Institution Comparison Chart & Cards */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-2 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Perbandingan Progres Antar Lembaga
            </h2>
            <p className="text-xs text-slate-500">
              Klik &ldquo;Masuk Lembaga&rdquo; untuk mengelola data warga belajar, soal, dan sinkronisasi Google Workspace lembaga terkait
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-xs bg-blue-700" />
              Kehadiran (%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-xs bg-emerald-600" />
              Rerata Nilai Evaluasi
            </span>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <th className="px-4 py-3">Lembaga & Kepala</th>
                <th className="px-4 py-3 text-right">Warga Belajar</th>
                <th className="px-4 py-3">Capaian Kehadiran & Nilai</th>
                <th className="px-4 py-3 text-right">Bobot SKK (TM/Tut/Mdr)</th>
                <th className="px-4 py-3 text-right">EWS Drop-Out</th>
                <th className="px-4 py-3">Google Workspace</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {institutionSummaries.map(
                ({
                  inst,
                  learnerCount,
                  attRate,
                  avgScore,
                  highRiskCount,
                }) => (
                  <tr key={inst.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">{inst.nama}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {inst.kota} · {inst.kepalaLembaga} ·{' '}
                        <span className="font-mono">{inst.kode}</span>
                      </p>
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-sm font-semibold text-slate-900 tabular-nums">
                      {learnerCount}
                    </td>
                    <td className="px-4 py-4 min-w-[210px]">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                          <div className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
                            <div
                              className="h-full bg-blue-700"
                              style={{ width: `${attRate}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-slate-700">
                            {attRate}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
                          <div className="h-2 flex-1 overflow-hidden rounded bg-slate-100">
                            <div
                              className="h-full bg-emerald-600"
                              style={{ width: `${avgScore}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-slate-700">
                            {avgScore}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-xs text-slate-600 tabular-nums">
                      {inst.skkWeights.tatapMuka}% / {inst.skkWeights.tutorial}% /{' '}
                      {inst.skkWeights.mandiri}%
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-xs tabular-nums">
                      {highRiskCount > 0 ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {highRiskCount} risiko tinggi
                        </span>
                      ) : (
                        <span className="font-medium text-emerald-700">
                          0 risiko
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs">
                      {inst.workspaceConfig?.spreadsheetId ? (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                          <FileSpreadsheet className="h-3.5 w-3.5" />
                          Sheets & Drive Aktif
                        </span>
                      ) : (
                        <span className="text-slate-500">
                          Belum dikonfigurasi
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => onSwitchInstitution(inst.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 whitespace-nowrap"
                      >
                        <span>Kelola Lembaga</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cross-institution Learner Monitoring Table */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Pemantauan Warga Belajar Lintas Lembaga & EWS Drop-Out
            </h2>
            <p className="text-xs text-slate-500">
              Nilai SKK terbobot dihitung dari proporsi Tatap Muka, Tutorial, dan Mandiri masing-masing lembaga
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchLearner}
                onChange={(e) => setSearchLearner(e.target.value)}
                placeholder="Cari siswa / NISN..."
                className="rounded-lg border border-slate-200 py-1.5 pr-3 pl-8 text-xs focus:border-blue-600 focus:outline-none"
              />
            </div>
            <select
              value={selectedInstFilter}
              onChange={(e) => setSelectedInstFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
            >
              <option value="Semua">Semua Lembaga</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nama}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <th className="px-6 py-3">Warga Belajar</th>
                <th className="px-4 py-3">Lembaga</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3 text-right">Kehadiran</th>
                <th className="px-4 py-3 text-right">Skor Ujian</th>
                <th className="px-4 py-3 text-right">Nilai SKK Terbobot</th>
                <th className="px-6 py-3">Status EWS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {crossInstitutionLearners.map(
                ({
                  learner,
                  instName,
                  attRate,
                  avgScore,
                  weightedSkkScore,
                  isDropOutRisk,
                  isWarning,
                }) => (
                  <tr key={learner.id} className="hover:bg-slate-50/70">
                    <td className="px-6 py-3">
                      <p className="font-medium text-slate-900">{learner.nama}</p>
                      <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                        {learner.id} · NISN {learner.nisn}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700">
                      {instName}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {learner.program} ({learner.rombel})
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                      <span
                        className={
                          attRate < 75
                            ? 'font-semibold text-red-700'
                            : 'text-slate-800'
                        }
                      >
                        {attRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                      {avgScore !== null ? (
                        <span
                          className={
                            avgScore < learner.targetKompetensi
                              ? 'font-semibold text-red-700'
                              : 'font-semibold text-emerald-700'
                          }
                        >
                          {avgScore} / {learner.targetKompetensi}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-blue-700 tabular-nums">
                      {weightedSkkScore}
                    </td>
                    <td className="px-6 py-3 text-xs font-medium">
                      {isDropOutRisk ? (
                        <span className="inline-flex items-center gap-1 text-red-700">
                          <ShieldAlert className="h-4 w-4 shrink-0" />
                          Risiko Drop-Out
                        </span>
                      ) : isWarning ? (
                        <span className="inline-flex items-center gap-1 text-amber-700">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          Perlu Pendampingan
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          Aman / Terkendali
                        </span>
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
