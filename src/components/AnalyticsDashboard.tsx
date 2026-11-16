import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  QrCode,
  Send,
} from 'lucide-react';
import {
  AttendanceRecord,
  Learner,
  QuizAttempt,
  TutorNotification,
} from '../types';

interface AnalyticsDashboardProps {
  learners: Learner[];
  attendance: AttendanceRecord[];
  attempts: QuizAttempt[];
  notifications: TutorNotification[];
  onInspectLearner: (learnerId: string) => void;
  onOpenCard: (learnerId: string) => void;
  onOpenNotifications: () => void;
  onStartQuiz: () => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${String(s).padStart(2, '0')}d`;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  learners,
  attendance,
  attempts,
  notifications,
  onInspectLearner,
  onOpenCard,
  onOpenNotifications,
  onStartQuiz,
}) => {
  const [hoveredSubject, setHoveredSubject] = useState<string | null>(null);
  const [hoveredDayIndex, setHoveredDayIndex] = useState<number | null>(null);
  const [programFilter, setProgramFilter] = useState<string>('Semua');

  const activeLearners = useMemo(
    () => learners.filter((l) => l.status === 'Aktif'),
    [learners]
  );

  const overallAttendanceRate = useMemo(() => {
    if (attendance.length === 0) return 0;
    const present = attendance.filter((a) => a.status === 'Hadir').length;
    return Math.round((present / attendance.length) * 100);
  }, [attendance]);

  const competencyStats = useMemo(() => {
    if (attempts.length === 0) {
      return { avgScore: 0, passRate: 0, avgDuration: 0 };
    }
    const avgScore = Math.round(
      attempts.reduce((sum, a) => sum + a.skor, 0) / attempts.length
    );
    const passed = attempts.filter((a) => a.tuntas).length;
    const passRate = Math.round((passed / attempts.length) * 100);
    const avgDuration = Math.round(
      attempts.reduce((sum, a) => sum + a.totalDurasiDetik, 0) / attempts.length
    );
    return { avgScore, passRate, avgDuration };
  }, [attempts]);

  const pendingAlertsCount = useMemo(
    () => notifications.filter((n) => n.statusKirim === 'Menunggu Tindakan').length,
    [notifications]
  );

  // Subject breakdown for Bar Chart
  const subjectData = useMemo(() => {
    const map = new Map<
      string,
      { subject: string; totalScore: number; totalTarget: number; count: number }
    >();
    for (const att of attempts) {
      const curr = map.get(att.mataPelajaran) || {
        subject: att.mataPelajaran,
        totalScore: 0,
        totalTarget: 0,
        count: 0,
      };
      curr.totalScore += att.skor;
      curr.totalTarget += att.targetNilai;
      curr.count += 1;
      map.set(att.mataPelajaran, curr);
    }
    return Array.from(map.values()).map((item) => ({
      subject: item.subject,
      avgScore: Math.round(item.totalScore / item.count),
      avgTarget: Math.round(item.totalTarget / item.count),
      count: item.count,
    }));
  }, [attempts]);

  // Daily attendance trend (last 10 distinct dates)
  const attendanceTrend = useMemo(() => {
    const dateMap = new Map<string, { present: number; total: number }>();
    for (const rec of attendance) {
      const curr = dateMap.get(rec.tanggal) || { present: 0, total: 0 };
      curr.total += 1;
      if (rec.status === 'Hadir') curr.present += 1;
      dateMap.set(rec.tanggal, curr);
    }
    return Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-10)
      .map(([tanggal, val]) => ({
        tanggal,
        label: tanggal.slice(5), // MM-DD
        rate: val.total > 0 ? Math.round((val.present / val.total) * 100) : 0,
        present: val.present,
        total: val.total,
      }));
  }, [attendance]);

  // Individual evaluation matrix
  const learnerRows = useMemo(() => {
    return learners
      .filter((l) => programFilter === 'Semua' || l.program === programFilter)
      .map((learner) => {
        const lAtt = attendance.filter((a) => a.learnerId === learner.id);
        const lPresent = lAtt.filter((a) => a.status === 'Hadir').length;
        const attRate = lAtt.length > 0 ? Math.round((lPresent / lAtt.length) * 100) : 100;

        const lAttempts = attempts
          .filter((at) => at.learnerId === learner.id)
          .sort((a, b) => b.tanggalPengerjaan.localeCompare(a.tanggalPengerjaan));
        const avgScore =
          lAttempts.length > 0
            ? Math.round(
                lAttempts.reduce((sum, a) => sum + a.skor, 0) / lAttempts.length
              )
            : null;
        const avgDuration =
          lAttempts.length > 0
            ? Math.round(
                lAttempts.reduce((sum, a) => sum + a.totalDurasiDetik, 0) /
                  lAttempts.length
              )
            : 0;

        const isAchieved =
          avgScore !== null
            ? avgScore >= learner.targetKompetensi && attRate >= 75
            : attRate >= 75;

        return {
          learner,
          attRate,
          lAttTotal: lAtt.length,
          avgScore,
          attemptCount: lAttempts.length,
          avgDuration,
          isAchieved,
        };
      });
  }, [learners, attendance, attempts, programFilter]);

  return (
    <div className="space-y-8">
      {/* Header Row */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-500">
            Ringkasan Evaluasi Akademik · Tahun Ajaran 2026/2027
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Dasbor Analitik Capaian Warga Belajar
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenNotifications}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span className="tabular-nums">
              Notifikasi Tutor ({pendingAlertsCount})
            </span>
          </button>
          <button
            type="button"
            onClick={onStartQuiz}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
          >
            <span>Mulai Evaluasi Real-Time</span>
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">
            Warga Belajar Aktif
          </p>
          <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {activeLearners.length}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Total {learners.length} terdaftar lintas 4 program
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">
            Rata-Rata Kehadiran Harian
          </p>
          <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {overallAttendanceRate}%
          </p>
          <p className="mt-2 text-xs text-emerald-700">
            {overallAttendanceRate >= 80
              ? 'Memenuhi ambang kehadiran minimal 75%'
              : 'Perlu peningkatan kehadiran harian'}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">
            Ketuntasan Evaluasi Soal
          </p>
          <div className="mt-2 flex items-baseline gap-2.5">
            <p className="font-mono text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
              {competencyStats.passRate}%
            </p>
            <span className="font-mono text-xs text-slate-500 tabular-nums">
              Rata-rata {competencyStats.avgScore} poin
            </span>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 tabular-nums">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>
              Durasi rerata {formatDuration(competencyStats.avgDuration)}
            </span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">
            Peringatan Target Belum Tercapai
          </p>
          <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-red-700 tabular-nums">
            {pendingAlertsCount}
          </p>
          <p className="mt-2 text-xs text-slate-600">
            Menunggu pengiriman notifikasi ke tutor
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Chart 1: Capaian per Mata Pelajaran vs Target KKM */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Capaian Kompetensi per Bidang vs Target KKM
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Perbandingan skor rata-rata individu terhadap ambang ketuntasan
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-xs bg-blue-700" />
                Skor Rata-rata
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-xs bg-slate-300" />
                Target KKM
              </span>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            {subjectData.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">
                Belum ada data pengerjaan soal.
              </p>
            ) : (
              subjectData.map((item) => {
                const isMet = item.avgScore >= item.avgTarget;
                const isHovered = hoveredSubject === item.subject;
                return (
                  <div
                    key={item.subject}
                    onMouseEnter={() => setHoveredSubject(item.subject)}
                    onMouseLeave={() => setHoveredSubject(null)}
                    className={`rounded-lg p-2 transition-colors ${
                      isHovered ? 'bg-slate-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium text-slate-800">
                        {item.subject}
                      </span>
                      <div className="flex items-center gap-3 font-mono text-xs tabular-nums">
                        <span
                          className={
                            isMet ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'
                          }
                        >
                          {item.avgScore} / {item.avgTarget}
                        </span>
                        <span className="text-slate-400">
                          ({item.count} sesi)
                        </span>
                      </div>
                    </div>

                    <div className="relative mt-2 h-5 w-full overflow-hidden rounded bg-slate-100">
                      {/* Target marker line */}
                      <div
                        className="absolute top-0 bottom-0 z-10 w-0.5 bg-slate-500"
                        style={{ left: `${Math.min(100, item.avgTarget)}%` }}
                        title={`Target KKM: ${item.avgTarget}`}
                      />
                      {/* Actual score bar */}
                      <div
                        className={`h-full rounded-l transition-all duration-300 ${
                          isMet ? 'bg-blue-700' : 'bg-amber-600'
                        }`}
                        style={{ width: `${Math.min(100, item.avgScore)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Chart 2: Tren Kehadiran Harian SVG */}
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Tren Kehadiran Harian Warga Belajar
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Persentase kehadiran pada 10 hari pertemuan terakhir
              </p>
            </div>
            {hoveredDayIndex !== null && attendanceTrend[hoveredDayIndex] && (
              <div className="text-right font-mono text-xs tabular-nums">
                <p className="font-semibold text-slate-900">
                  {attendanceTrend[hoveredDayIndex].tanggal}
                </p>
                <p className="text-blue-700">
                  {attendanceTrend[hoveredDayIndex].rate}% (
                  {attendanceTrend[hoveredDayIndex].present}/
                  {attendanceTrend[hoveredDayIndex].total} hadir)
                </p>
              </div>
            )}
          </div>

          <div className="mt-6">
            {attendanceTrend.length === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">
                Belum ada catatan absensi harian.
              </p>
            ) : (
              <div className="w-full overflow-x-auto">
                <svg
                  viewBox="0 0 560 210"
                  className="h-52 w-full"
                  role="img"
                  aria-label="Grafik tren kehadiran harian"
                >
                  {/* Grid lines */}
                  {[25, 50, 75, 100].map((val) => {
                    const y = 170 - (val / 100) * 140;
                    return (
                      <g key={val}>
                        <line
                          x1="42"
                          y1={y}
                          x2="540"
                          y2={y}
                          stroke={val === 75 ? '#f59e0b' : '#e2e8f0'}
                          strokeDasharray={val === 75 ? '4 4' : undefined}
                          strokeWidth="1"
                        />
                        <text
                          x="34"
                          y={y + 4}
                          textAnchor="end"
                          className="fill-slate-400 font-mono text-[10px]"
                        >
                          {val}%
                        </text>
                      </g>
                    );
                  })}

                  {/* Polyline & Area */}
                  {(() => {
                    const pts = attendanceTrend.map((d, idx) => {
                      const x =
                        48 +
                        (attendanceTrend.length === 1
                          ? 240
                          : (idx / (attendanceTrend.length - 1)) * 484);
                      const y = 170 - (d.rate / 100) * 140;
                      return { x, y, ...d };
                    });

                    const linePath = pts
                      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
                      .join(' ');
                    const areaPath = `${linePath} L ${pts[pts.length - 1].x} 170 L ${pts[0].x} 170 Z`;

                    return (
                      <>
                        <path d={areaPath} fill="#1d4ed8" fillOpacity="0.08" />
                        <path
                          d={linePath}
                          fill="none"
                          stroke="#1d4ed8"
                          strokeWidth="2.5"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                        {pts.map((p, idx) => (
                          <g
                            key={p.tanggal}
                            onMouseEnter={() => setHoveredDayIndex(idx)}
                            onMouseLeave={() => setHoveredDayIndex(null)}
                            className="cursor-pointer"
                          >
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={hoveredDayIndex === idx ? 6 : 4}
                              fill={p.rate < 75 ? '#d97706' : '#1d4ed8'}
                              stroke="#ffffff"
                              strokeWidth="2"
                            />
                            <text
                              x={p.x}
                              y="194"
                              textAnchor="middle"
                              className="fill-slate-500 font-mono text-[10px]"
                            >
                              {p.label}
                            </text>
                          </g>
                        ))}
                      </>
                    );
                  })()}
                </svg>
              </div>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Garis putus-putus amber menandakan batas minimal kehadiran 75%.
            </p>
          </div>
        </div>
      </div>

      {/* Individual Competency Evaluation Matrix */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Pemantauan Kompetensi Individu Real-Time
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Status ketercapaian target KKM dan kehadiran per warga belajar
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
            {['Semua', 'Paket A', 'Paket B', 'Paket C', 'Kursus Vokasi'].map(
              (prog) => (
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
              )
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <th className="px-6 py-3">Warga Belajar</th>
                <th className="px-4 py-3">Program / Rombel</th>
                <th className="px-4 py-3 text-right">Kehadiran</th>
                <th className="px-4 py-3 text-right">Rata-Rata Skor</th>
                <th className="px-4 py-3 text-right">Durasi Rerata</th>
                <th className="px-4 py-3">Status Kompetensi</th>
                <th className="px-6 py-3 text-right">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {learnerRows.map(
                ({
                  learner,
                  attRate,
                  avgScore,
                  attemptCount,
                  avgDuration,
                  isAchieved,
                }) => (
                  <tr
                    key={learner.id}
                    className="transition-colors hover:bg-slate-50/80"
                  >
                    <td className="px-6 py-3.5">
                      <div className="font-medium text-slate-900">
                        {learner.nama}
                      </div>
                      <div className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums">
                        {learner.id} · NISN {learner.nisn}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      <div className="font-medium text-slate-800">
                        {learner.program}
                      </div>
                      <div>{learner.rombel}</div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums">
                      <span
                        className={
                          attRate >= 75
                            ? 'font-semibold text-slate-800'
                            : 'font-semibold text-red-700'
                        }
                      >
                        {attRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums">
                      {avgScore !== null ? (
                        <div>
                          <span
                            className={
                              avgScore >= learner.targetKompetensi
                                ? 'font-semibold text-emerald-700'
                                : 'font-semibold text-red-700'
                            }
                          >
                            {avgScore}
                          </span>
                          <span className="text-slate-400">
                            {' '}
                            / {learner.targetKompetensi}
                          </span>
                          <div className="text-[11px] text-slate-400">
                            {attemptCount} evaluasi
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">Belum ada ujian</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-600 tabular-nums">
                      {attemptCount > 0 ? formatDuration(avgDuration) : '—'}
                    </td>
                    <td className="px-4 py-3.5">
                      {isAchieved ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          <span>Target Tercapai</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>Perlu Pendampingan</span>
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onInspectLearner(learner.id)}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                          title="Lihat detail riwayat belajar"
                        >
                          <FileSpreadsheet className="mr-1 inline h-3.5 w-3.5" />
                          Riwayat
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenCard(learner.id)}
                          className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
                          title="Cetak kartu QR warga belajar"
                        >
                          <QrCode className="mr-1 inline h-3.5 w-3.5" />
                          Kartu QR
                        </button>
                        {!isAchieved && (
                          <button
                            type="button"
                            onClick={onOpenNotifications}
                            className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 whitespace-nowrap"
                            title="Buka antrean notifikasi tutor"
                          >
                            <Send className="mr-1 inline h-3.5 w-3.5" />
                            Tutor
                          </button>
                        )}
                      </div>
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
