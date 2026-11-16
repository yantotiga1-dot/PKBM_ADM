import React, { useMemo, useState } from 'react';
import {
  CloudUpload,
  Download,
  FileBarChart2,
  Printer,
} from 'lucide-react';
import {
  AttendanceRecord,
  Learner,
  ProgramType,
  QuizAttempt,
} from '../types';

interface ProgressReportsProps {
  learners: Learner[];
  attendance: AttendanceRecord[];
  attempts: QuizAttempt[];
  isWorkspaceConnected: boolean;
  onSaveReportToDrive: (fileName: string, csvContent: string) => void;
}

type PeriodPreset = 'mingguan' | 'bulanan' | 'triwulan' | 'kustom';

function shiftDays(baseIso: string, deltaDays: number): string {
  const d = new Date(`${baseIso}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export const ProgressReports: React.FC<ProgressReportsProps> = ({
  learners,
  attendance,
  attempts,
  isWorkspaceConnected,
  onSaveReportToDrive,
}) => {
  const todayStr = '2026-11-15';
  const [preset, setPreset] = useState<PeriodPreset>('mingguan');
  const [customStart, setCustomStart] = useState<string>(shiftDays(todayStr, -14));
  const [customEnd, setCustomEnd] = useState<string>(todayStr);
  const [programFilter, setProgramFilter] = useState<string>('Semua');

  const { startDate, endDate, periodLabel } = useMemo(() => {
    if (preset === 'mingguan') {
      return {
        startDate: shiftDays(todayStr, -6),
        endDate: todayStr,
        periodLabel: 'Laporan Mingguan (7 Hari Terakhir)',
      };
    }
    if (preset === 'bulanan') {
      return {
        startDate: shiftDays(todayStr, -29),
        endDate: todayStr,
        periodLabel: 'Laporan Bulanan (30 Hari Terakhir)',
      };
    }
    if (preset === 'triwulan') {
      return {
        startDate: shiftDays(todayStr, -89),
        endDate: todayStr,
        periodLabel: 'Laporan Triwulan (90 Hari Terakhir)',
      };
    }
    return {
      startDate: customStart,
      endDate: customEnd,
      periodLabel: `Laporan Periode Kustom (${customStart} s.d. ${customEnd})`,
    };
  }, [preset, customStart, customEnd]);

  const reportRows = useMemo(() => {
    return learners
      .filter((l) => programFilter === 'Semua' || l.program === programFilter)
      .map((learner) => {
        const periodAtt = attendance.filter(
          (a) =>
            a.learnerId === learner.id &&
            a.tanggal >= startDate &&
            a.tanggal <= endDate
        );
        const hadir = periodAtt.filter((a) => a.status === 'Hadir').length;
        const izin = periodAtt.filter((a) => a.status === 'Izin').length;
        const sakit = periodAtt.filter((a) => a.status === 'Sakit').length;
        const alfa = periodAtt.filter((a) => a.status === 'Alfa').length;
        const attRate =
          periodAtt.length > 0
            ? Math.round((hadir / periodAtt.length) * 100)
            : 100;

        const periodAttempts = attempts.filter((at) => {
          const d = at.tanggalPengerjaan.slice(0, 10);
          return at.learnerId === learner.id && d >= startDate && d <= endDate;
        });

        const avgScore =
          periodAttempts.length > 0
            ? Math.round(
                periodAttempts.reduce((sum, a) => sum + a.skor, 0) /
                  periodAttempts.length
              )
            : null;
        const avgDuration =
          periodAttempts.length > 0
            ? Math.round(
                periodAttempts.reduce((sum, a) => sum + a.totalDurasiDetik, 0) /
                  periodAttempts.length
              )
            : 0;

        let rekomendasi = 'Pertahankan ritme belajar dan lanjutkan modul berikutnya.';
        let status = 'Tuntas';

        if (avgScore !== null && avgScore < learner.targetKompetensi && attRate < 75) {
          status = 'Perlu Intervensi Ganda';
          rekomendasi =
            'Jadwalkan pendampingan remedial tutor serta konfirmasi kehadiran ke wali/peserta.';
        } else if (avgScore !== null && avgScore < learner.targetKompetensi) {
          status = 'Belum Mencapai KKM';
          rekomendasi = `Berikan latihan pengayaan terarah hingga mencapai target ${learner.targetKompetensi}.`;
        } else if (attRate < 75) {
          status = 'Kehadiran Rendah';
          rekomendasi = 'Tindak lanjuti kedisiplinan absensi harian bersama tutor pembimbing.';
        } else if (avgScore === null) {
          status = 'Belum Ada Evaluasi';
          rekomendasi = 'Arahkan warga belajar menyelesaikan evaluasi modul pada periode ini.';
        }

        return {
          learner,
          totalSesi: periodAtt.length,
          hadir,
          izinSakit: izin + sakit,
          alfa,
          attRate,
          attemptCount: periodAttempts.length,
          avgScore,
          avgDuration,
          status,
          rekomendasi,
        };
      });
  }, [learners, attendance, attempts, startDate, endDate, programFilter]);

  const aggregateStats = useMemo(() => {
    const totalEval = reportRows.reduce((s, r) => s + r.attemptCount, 0);
    const scoredRows = reportRows.filter((r) => r.avgScore !== null);
    const avgAllScore =
      scoredRows.length > 0
        ? Math.round(
            scoredRows.reduce((s, r) => s + (r.avgScore || 0), 0) /
              scoredRows.length
          )
        : 0;
    const avgAllAtt =
      reportRows.length > 0
        ? Math.round(
            reportRows.reduce((s, r) => s + r.attRate, 0) / reportRows.length
          )
        : 0;
    const needFollowUp = reportRows.filter(
      (r) =>
        r.status === 'Belum Mencapai KKM' ||
        r.status === 'Perlu Intervensi Ganda' ||
        r.status === 'Kehadiran Rendah'
    ).length;

    return { totalEval, avgAllScore, avgAllAtt, needFollowUp };
  }, [reportRows]);

  const buildCsvContent = () => {
    const headers = [
      'ID',
      'Nama Warga Belajar',
      'Program',
      'Rombel',
      'Periode',
      'Kehadiran (%)',
      'Hadir',
      'Izin/Sakit',
      'Alfa',
      'Jumlah Evaluasi',
      'Rata-Rata Skor',
      'Target KKM',
      'Durasi Rerata (Detik)',
      'Status Capaian',
      'Rekomendasi Pengajar',
    ];
    const lines = reportRows.map((r) => [
      r.learner.id,
      `"${r.learner.nama}"`,
      r.learner.program,
      r.learner.rombel,
      `"${startDate} s.d. ${endDate}"`,
      r.attRate,
      r.hadir,
      r.izinSakit,
      r.alfa,
      r.attemptCount,
      r.avgScore ?? '-',
      r.learner.targetKompetensi,
      r.avgDuration,
      `"${r.status}"`,
      `"${r.rekomendasi}"`,
    ]);
    return [headers.join(','), ...lines.map((l) => l.join(','))].join('\n');
  };

  const handleDownloadCsv = () => {
    const csv = buildCsvContent();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Kemajuan_${startDate}_sd_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="no-print flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Agregasi Kehadiran, Kompetensi & Rekomendasi Otomatis Berbasis Rentang Waktu
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Laporan Kemajuan Otomatis Pengajar
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-4 w-4" />
            <span>Unduh CSV</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onSaveReportToDrive(
                `Laporan_Kemajuan_${startDate}_sd_${endDate}.csv`,
                buildCsvContent()
              )
            }
            disabled={!isWorkspaceConnected}
            title={
              isWorkspaceConnected
                ? 'Arsipkan laporan ini ke Google Drive'
                : 'Hubungkan Google Drive terlebih dahulu'
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
          >
            <CloudUpload className="h-4 w-4 text-blue-700" />
            <span>Simpan ke Drive</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap"
          >
            <Printer className="h-4 w-4" />
            <span>Cetak / PDF</span>
          </button>
        </div>
      </div>

      {/* Period & Filter Controls */}
      <div className="no-print flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-600">
            Periode Pelaporan Otomatis
          </label>
          <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
            {(
              [
                ['mingguan', 'Mingguan (7 Hari)'],
                ['bulanan', 'Bulanan (30 Hari)'],
                ['triwulan', 'Triwulan (90 Hari)'],
                ['kustom', 'Rentang Kustom'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setPreset(key)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  preset === key
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {preset === 'kustom' && (
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600">
                Dari Tanggal
              </label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="mt-1 rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600">
                Sampai Tanggal
              </label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="mt-1 rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-sm"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-600">
            Filter Program
          </label>
          <select
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
            className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
          >
            <option value="Semua">Semua Program</option>
            {(['Paket A', 'Paket B', 'Paket C', 'Kursus Vokasi'] as ProgramType[]).map(
              (p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {/* Printable Report Sheet */}
      <div className="print-only-container rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-start">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-700">
              <FileBarChart2 className="h-4 w-4" />
              <span>PKBM LENTERA BELAJAR · DOKUMEN EVALUASI AKADEMIK</span>
            </div>
            <h2 className="mt-1 text-xl font-bold text-slate-900">
              {periodLabel}
            </h2>
            <p className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums">
              Rentang Data: {startDate} s.d. {endDate} · Cakupan:{' '}
              {programFilter} ({reportRows.length} warga belajar)
            </p>
          </div>
          <div className="text-left font-mono text-xs text-slate-500 tabular-nums sm:text-right">
            <p>Tanggal Cetak: {todayStr}</p>
            <p>Status: Dihasilkan Otomatis oleh Sistem</p>
          </div>
        </div>

        {/* Summary KPIs inside report */}
        <div className="my-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <p className="text-xs text-slate-500">Rerata Kehadiran</p>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {aggregateStats.avgAllAtt}%
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <p className="text-xs text-slate-500">Rerata Skor Evaluasi</p>
            <p className="mt-1 font-mono text-2xl font-bold text-blue-700 tabular-nums">
              {aggregateStats.avgAllScore}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <p className="text-xs text-slate-500">Total Pengerjaan Soal</p>
            <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
              {aggregateStats.totalEval}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <p className="text-xs text-slate-500">Perlu Tindak Lanjut</p>
            <p className="mt-1 font-mono text-2xl font-bold text-red-700 tabular-nums">
              {aggregateStats.needFollowUp}
            </p>
          </div>
        </div>

        {/* Detailed Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50 font-semibold text-slate-700">
                <th className="py-3 pr-4 pl-2">Warga Belajar</th>
                <th className="px-3 py-3 text-right">Kehadiran</th>
                <th className="px-3 py-3 text-right">H / I+S / A</th>
                <th className="px-3 py-3 text-right">Evaluasi</th>
                <th className="px-3 py-3 text-right">Skor / KKM</th>
                <th className="px-3 py-3">Status</th>
                <th className="py-3 pr-2 pl-3">Rekomendasi Tindak Lanjut Pengajar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {reportRows.map((row) => (
                <tr key={row.learner.id}>
                  <td className="py-3 pr-4 pl-2">
                    <p className="font-semibold text-slate-900">
                      {row.learner.nama}
                    </p>
                    <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                      {row.learner.program} · {row.learner.tutorNama}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold text-slate-800 tabular-nums">
                    {row.attRate}%
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-600 tabular-nums">
                    {row.hadir} / {row.izinSakit} / {row.alfa}
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-slate-700 tabular-nums">
                    {row.attemptCount}x
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">
                    {row.avgScore !== null ? (
                      <span
                        className={
                          row.avgScore >= row.learner.targetKompetensi
                            ? 'font-bold text-emerald-700'
                            : 'font-bold text-red-700'
                        }
                      >
                        {row.avgScore}/{row.learner.targetKompetensi}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 font-semibold">
                    <span
                      className={
                        row.status === 'Tuntas'
                          ? 'text-emerald-700'
                          : row.status === 'Belum Ada Evaluasi'
                          ? 'text-slate-600'
                          : 'text-red-700'
                      }
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="py-3 pr-2 pl-3 leading-relaxed text-slate-600">
                    {row.rekomendasi}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
