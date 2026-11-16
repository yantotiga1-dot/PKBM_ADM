import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileCheck2,
  ListChecks,
  Play,
  Plus,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  Learner,
  LearningMode,
  LearningModule,
  ProgramType,
  QuestionAttemptDetail,
  Quiz,
  QuizAttempt,
  QuizQuestion,
} from '../types';

interface QuizSystemProps {
  institutionId: string;
  learners: Learner[];
  modules: LearningModule[];
  quizzes: Quiz[];
  attempts: QuizAttempt[];
  initialTab?: 'buat-soal' | 'pengerjaan' | 'hasil';
  preselectedLearnerId?: string | null;
  preselectedQuizId?: string | null;
  onAddQuiz: (quiz: Quiz) => void;
  onDeleteQuiz: (quizId: string) => void;
  onSubmitAttempt: (attempt: QuizAttempt) => void;
}

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const QuizSystem: React.FC<QuizSystemProps> = ({
  institutionId,
  learners,
  modules,
  quizzes,
  attempts,
  initialTab = 'pengerjaan',
  preselectedLearnerId,
  preselectedQuizId,
  onAddQuiz,
  onDeleteQuiz,
  onSubmitAttempt,
}) => {
  const [activeTab, setActiveTab] = useState<
    'buat-soal' | 'pengerjaan' | 'hasil'
  >(initialTab);

  // --- TAB 1: QUIZ BUILDER STATE ---
  const [judul, setJudul] = useState('');
  const [mataPelajaran, setMataPelajaran] = useState('');
  const [program, setProgram] = useState<ProgramType | 'Semua Program'>(
    'Semua Program'
  );
  const [moduleId, setModuleId] = useState<string>(modules[0]?.id || '');
  const [modePembelajaran, setModePembelajaran] =
    useState<LearningMode>('Tatap Muka');
  const [targetNilai, setTargetNilai] = useState(75);
  const [durasiMenit, setDurasiMenit] = useState(15);
  const [tutorPembuat, setTutorPembuat] = useState('Drs. Hendra Kusuma, M.Pd.');
  const [draftQuestions, setDraftQuestions] = useState<QuizQuestion[]>([
    {
      id: `Q-${Date.now()}-1`,
      pertanyaan: '',
      pilihan: ['', '', '', ''],
      kunciJawaban: 0,
      bobot: 25,
      pembahasan: '',
    },
  ]);

  const addDraftQuestion = () => {
    setDraftQuestions((prev) => [
      ...prev,
      {
        id: `Q-${Date.now()}-${prev.length + 1}`,
        pertanyaan: '',
        pilihan: ['', '', '', ''],
        kunciJawaban: 0,
        bobot: 25,
        pembahasan: '',
      },
    ]);
  };

  const updateDraftQuestion = (
    idx: number,
    patch: Partial<QuizQuestion>
  ) => {
    setDraftQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...patch } : q))
    );
  };

  const updateDraftOption = (qIdx: number, optIdx: number, val: string) => {
    setDraftQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const nextPilihan = [...q.pilihan] as [string, string, string, string];
        nextPilihan[optIdx] = val;
        return { ...q, pilihan: nextPilihan };
      })
    );
  };

  const handleCreateQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    const validQuestions = draftQuestions.filter(
      (q) => q.pertanyaan.trim() && q.pilihan.every((p) => p.trim())
    );
    if (!judul.trim() || !mataPelajaran.trim() || validQuestions.length === 0) {
      return;
    }

    const newQuiz: Quiz = {
      id: `QZ-${Date.now().toString().slice(-5)}`,
      institutionId,
      moduleId: moduleId || undefined,
      judul: judul.trim(),
      mataPelajaran: mataPelajaran.trim(),
      program,
      modePembelajaran,
      targetNilai,
      durasiMenit,
      tutorPembuat,
      tanggalDibuat: new Date().toISOString().slice(0, 10),
      soal: validQuestions,
    };

    onAddQuiz(newQuiz);
    setJudul('');
    setMataPelajaran('');
    setDraftQuestions([
      {
        id: `Q-${Date.now()}-1`,
        pertanyaan: '',
        pilihan: ['', '', '', ''],
        kunciJawaban: 0,
        bobot: 25,
        pembahasan: '',
      },
    ]);
    setSelectedQuizId(newQuiz.id);
    setActiveTab('pengerjaan');
  };

  // --- TAB 2: LIVE TIMED QUIZ RUNNER STATE ---
  const [selectedLearnerId, setSelectedLearnerId] = useState<string>(
    preselectedLearnerId || learners[0]?.id || ''
  );
  const [selectedQuizId, setSelectedQuizId] = useState<string>(
    preselectedQuizId || quizzes[0]?.id || ''
  );
  const [sessionStatus, setSessionStatus] = useState<
    'idle' | 'running' | 'completed'
  >('idle');
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [questionDurations, setQuestionDurations] = useState<
    Record<string, number>
  >({});
  const [totalElapsedSeconds, setTotalElapsedSeconds] = useState(0);
  const [lastCompletedAttempt, setLastCompletedAttempt] =
    useState<QuizAttempt | null>(null);

  useEffect(() => {
    if (preselectedLearnerId) setSelectedLearnerId(preselectedLearnerId);
  }, [preselectedLearnerId]);

  useEffect(() => {
    if (preselectedQuizId) {
      setSelectedQuizId(preselectedQuizId);
      setActiveTab('pengerjaan');
    }
  }, [preselectedQuizId]);

  useEffect(() => {
    if (learners.length > 0 && !learners.some((l) => l.id === selectedLearnerId)) {
      setSelectedLearnerId(learners[0].id);
    }
  }, [learners, selectedLearnerId]);

  useEffect(() => {
    if (quizzes.length > 0 && !quizzes.some((q) => q.id === selectedQuizId)) {
      setSelectedQuizId(quizzes[0].id);
    }
  }, [quizzes, selectedQuizId]);

  const activeQuiz = useMemo(
    () => quizzes.find((q) => q.id === selectedQuizId) || quizzes[0] || null,
    [quizzes, selectedQuizId]
  );

  const currentQuestion =
    activeQuiz && activeQuiz.soal[currentQIndex]
      ? activeQuiz.soal[currentQIndex]
      : null;

  const currentQuestionIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentQuestionIdRef.current = currentQuestion?.id || null;
  }, [currentQuestion?.id]);

  useEffect(() => {
    if (sessionStatus !== 'running') return;
    const interval = window.setInterval(() => {
      setTotalElapsedSeconds((prev) => prev + 1);
      const qId = currentQuestionIdRef.current;
      if (qId) {
        setQuestionDurations((prev) => ({
          ...prev,
          [qId]: (prev[qId] || 0) + 1,
        }));
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [sessionStatus]);

  const startQuizSession = (quizIdOverride?: string) => {
    const targetQuizId = quizIdOverride || selectedQuizId;
    if (quizIdOverride) setSelectedQuizId(quizIdOverride);
    const quizObj = quizzes.find((q) => q.id === targetQuizId);
    if (!quizObj || quizObj.soal.length === 0) return;

    setAnswers({});
    setQuestionDurations({});
    setTotalElapsedSeconds(0);
    setCurrentQIndex(0);
    setLastCompletedAttempt(null);
    setSessionStatus('running');
  };

  const finishQuizSession = () => {
    if (!activeQuiz) return;
    const learner = learners.find((l) => l.id === selectedLearnerId);
    if (!learner) return;

    let earnedWeight = 0;
    let totalWeight = 0;
    let totalBenar = 0;

    const detailSoal: QuestionAttemptDetail[] = activeQuiz.soal.map((q) => {
      const chosen = answers[q.id] !== undefined ? answers[q.id] : null;
      const benar = chosen === q.kunciJawaban;
      totalWeight += q.bobot || 1;
      if (benar) {
        earnedWeight += q.bobot || 1;
        totalBenar += 1;
      }
      return {
        questionId: q.id,
        jawabanDipilih: chosen,
        benar,
        durasiDetik: questionDurations[q.id] || 0,
      };
    });

    const skor =
      totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;
    const tuntas = skor >= activeQuiz.targetNilai;

    const attempt: QuizAttempt = {
      id: `ATT-${Date.now().toString().slice(-6)}`,
      institutionId,
      quizId: activeQuiz.id,
      quizJudul: activeQuiz.judul,
      mataPelajaran: activeQuiz.mataPelajaran,
      moduleId: activeQuiz.moduleId,
      modePembelajaran: activeQuiz.modePembelajaran,
      learnerId: learner.id,
      learnerNama: learner.nama,
      tanggalPengerjaan: new Date().toISOString(),
      skor,
      targetNilai: activeQuiz.targetNilai,
      tuntas,
      totalBenar,
      totalSoal: activeQuiz.soal.length,
      totalDurasiDetik: Math.max(1, totalElapsedSeconds),
      detailSoal,
    };

    onSubmitAttempt(attempt);
    setLastCompletedAttempt(attempt);
    setSessionStatus('completed');
  };

  // --- TAB 3: ATTEMPT HISTORY FILTER ---
  const [historyLearnerFilter, setHistoryLearnerFilter] = useState('Semua');
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(
    null
  );

  const filteredAttempts = useMemo(() => {
    return attempts
      .filter(
        (a) =>
          historyLearnerFilter === 'Semua' ||
          a.learnerId === historyLearnerFilter
      )
      .sort((a, b) => b.tanggalPengerjaan.localeCompare(a.tanggalPengerjaan));
  }, [attempts, historyLearnerFilter]);

  return (
    <div className="space-y-6">
      {/* Header + Sub-tabs */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Soal Modular & Remidial Otomatis · Kunci Jawaban Otomatis · Pelacakan Durasi Real-Time
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Evaluasi Soal & Kompetensi Individu
          </h1>
        </div>

        <div className="inline-flex rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setActiveTab('pengerjaan')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'pengerjaan'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Halaman Pengerjaan Soal
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('buat-soal')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'buat-soal'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Buat Soal & Bank Soal ({quizzes.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('hasil')}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              activeTab === 'hasil'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hasil Individu ({attempts.length})
          </button>
        </div>
      </div>

      {/* TAB 2: REAL-TIME TIMED ASSESSMENT RUNNER */}
      {activeTab === 'pengerjaan' && (
        <div className="space-y-6">
          {sessionStatus === 'idle' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
                <h2 className="text-base font-semibold text-slate-900">
                  Mulai Sesi Evaluasi Baru
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Menghitung durasi per soal dan total waktu secara real-time, lalu menilai otomatis & menerbitkan soal remidial bila skor di bawah KKM.
                </p>

                <div className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Pilih Warga Belajar
                    </label>
                    <select
                      value={selectedLearnerId}
                      onChange={(e) => setSelectedLearnerId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    >
                      {learners.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.nama} — {l.program} ({l.rombel})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">
                      Pilih Paket Soal Evaluasi
                    </label>
                    <select
                      value={selectedQuizId}
                      onChange={(e) => setSelectedQuizId(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                    >
                      {quizzes.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.isRemedial ? '[REMIDIAL] ' : ''}
                          {q.judul} ({q.soal.length} soal · KKM {q.targetNilai})
                        </option>
                      ))}
                    </select>
                  </div>

                  {activeQuiz && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
                      <div className="grid grid-cols-2 gap-2 font-mono tabular-nums">
                        <div>
                          <span className="text-slate-500">Mata Pelajaran:</span>
                          <p className="font-sans font-semibold text-slate-900">
                            {activeQuiz.mataPelajaran}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Jalur SKK:</span>
                          <p className="font-sans font-semibold text-blue-700">
                            {activeQuiz.modePembelajaran}
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Target KKM:</span>
                          <p className="font-semibold text-slate-900">
                            {activeQuiz.targetNilai} poin
                          </p>
                        </div>
                        <div>
                          <span className="text-slate-500">Batas Waktu:</span>
                          <p className="font-semibold text-slate-900">
                            {activeQuiz.durasiMenit} menit
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => startQuizSession()}
                    disabled={!activeQuiz || activeQuiz.soal.length === 0}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                  >
                    <Play className="h-4 w-4" />
                    <span>Mulai Pengerjaan & Aktifkan Timer</span>
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
                <h2 className="text-base font-semibold text-slate-900">
                  Daftar Paket Soal & Remidial Tersedia
                </h2>
                <div className="mt-4 divide-y divide-slate-200">
                  {quizzes.map((q) => (
                    <div
                      key={q.id}
                      className="flex flex-col justify-between gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">
                          {q.isRemedial && (
                            <span className="mr-1.5 text-xs font-bold text-red-700">
                              [Remidial Otomatis]
                            </span>
                          )}
                          {q.judul}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {q.mataPelajaran} · {q.modePembelajaran} · {q.program}{' '}
                          · {q.soal.length} soal · Target KKM {q.targetNilai}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => startQuizSession(q.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap shrink-0"
                      >
                        <Play className="h-3.5 w-3.5 text-blue-700" />
                        <span>Kerjakan</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {sessionStatus === 'running' && activeQuiz && currentQuestion && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-8">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <p className="text-xs font-medium text-slate-500">
                      {activeQuiz.judul} ·{' '}
                      {learners.find((l) => l.id === selectedLearnerId)?.nama}
                    </p>
                    <h2 className="mt-0.5 text-base font-bold text-slate-900">
                      Soal {currentQIndex + 1} dari {activeQuiz.soal.length}
                    </h2>
                  </div>

                  <div className="flex items-center gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 font-mono text-xs tabular-nums">
                    <div>
                      <span className="block text-[10px] text-slate-500">
                        Durasi Soal Ini
                      </span>
                      <span className="font-semibold text-blue-700">
                        {formatClock(questionDurations[currentQuestion.id] || 0)}
                      </span>
                    </div>
                    <div className="h-6 w-px bg-slate-200" />
                    <div>
                      <span className="block text-[10px] text-slate-500">
                        Total Waktu Berjalan
                      </span>
                      <span className="font-semibold text-slate-900">
                        {formatClock(totalElapsedSeconds)} /{' '}
                        {formatClock(activeQuiz.durasiMenit * 60)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="py-6">
                  <p className="text-base font-medium leading-relaxed text-slate-900">
                    {currentQuestion.pertanyaan}
                  </p>

                  <div className="mt-5 space-y-2.5">
                    {currentQuestion.pilihan.map((optText, optIdx) => {
                      const isSelected =
                        answers[currentQuestion.id] === optIdx;
                      const letter = String.fromCharCode(65 + optIdx);
                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() =>
                            setAnswers((prev) => ({
                              ...prev,
                              [currentQuestion.id]: optIdx,
                            }))
                          }
                          className={`flex w-full items-start gap-3 rounded-lg border p-3.5 text-left text-sm transition-colors ${
                            isSelected
                              ? 'border-blue-700 bg-blue-50/70 text-slate-900'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded font-mono text-xs font-semibold ${
                              isSelected
                                ? 'bg-blue-700 text-white'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {letter}
                          </span>
                          <span className="leading-relaxed">{optText}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    disabled={currentQIndex === 0}
                    onClick={() => setCurrentQIndex((i) => Math.max(0, i - 1))}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Sebelumnya</span>
                  </button>

                  {currentQIndex < activeQuiz.soal.length - 1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setCurrentQIndex((i) =>
                          Math.min(activeQuiz.soal.length - 1, i + 1)
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                    >
                      <span>Soal Berikutnya</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={finishQuizSession}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
                    >
                      <FileCheck2 className="h-4 w-4" />
                      <span>Selesaikan & Nilai Otomatis</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-4 lg:col-span-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Navigasi Nomor Soal
                  </h3>
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {activeQuiz.soal.map((q, idx) => {
                      const answered = answers[q.id] !== undefined;
                      const current = idx === currentQIndex;
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => setCurrentQIndex(idx)}
                          className={`rounded-lg border py-2 font-mono text-xs font-semibold tabular-nums transition-colors ${
                            current
                              ? 'border-blue-700 bg-blue-700 text-white'
                              : answered
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {idx + 1}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-4 border-t border-slate-200 pt-3 text-xs text-slate-600">
                    <div className="flex justify-between font-mono tabular-nums">
                      <span>Terjawab:</span>
                      <span className="font-semibold text-slate-900">
                        {Object.keys(answers).length} / {activeQuiz.soal.length}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={finishQuizSession}
                    className="mt-4 w-full rounded-lg border border-blue-700 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-100"
                  >
                    Kirim Jawaban Sekarang
                  </button>
                </div>
              </div>
            </div>
          )}

          {sessionStatus === 'completed' &&
            lastCompletedAttempt &&
            activeQuiz && (
              <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {lastCompletedAttempt.tuntas ? (
                        <span className="inline-flex items-center gap-1.5 text-emerald-700">
                          <CheckCircle2 className="h-5 w-5" />
                          Target Kompetensi Tercapai
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-red-700">
                          <AlertTriangle className="h-5 w-5" />
                          Target Belum Tercapai — Notifikasi Tutor & Soal Remidial Otomatis Diterbitkan
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      {lastCompletedAttempt.learnerNama} ·{' '}
                      {lastCompletedAttempt.quizJudul}
                    </h2>
                  </div>

                  <div className="flex items-center gap-6 font-mono tabular-nums">
                    <div>
                      <p className="text-xs text-slate-500">Skor Akhir</p>
                      <p
                        className={`text-3xl font-bold ${
                          lastCompletedAttempt.tuntas
                            ? 'text-emerald-700'
                            : 'text-red-700'
                        }`}
                      >
                        {lastCompletedAttempt.skor}
                        <span className="text-sm font-normal text-slate-400">
                          /{lastCompletedAttempt.targetNilai}
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Total Durasi</p>
                      <p className="text-xl font-semibold text-slate-900">
                        {formatClock(lastCompletedAttempt.totalDurasiDetik)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Pembahasan Kunci Jawaban Otomatis & Rincian Waktu per Soal
                  </h3>
                  {activeQuiz.soal.map((q, idx) => {
                    const detail = lastCompletedAttempt.detailSoal.find(
                      (d) => d.questionId === q.id
                    );
                    const chosenIdx = detail?.jawabanDipilih ?? null;
                    return (
                      <div
                        key={q.id}
                        className="rounded-lg border border-slate-200 p-4 text-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-medium text-slate-900">
                            {idx + 1}. {q.pertanyaan}
                          </p>
                          <div className="flex items-center gap-3 shrink-0 font-mono text-xs tabular-nums">
                            <span className="text-slate-500">
                              <Clock className="mr-1 inline h-3.5 w-3.5" />
                              {detail?.durasiDetik || 0}d
                            </span>
                            {detail?.benar ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                                <CheckCircle2 className="h-4 w-4" />
                                Benar
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                                <XCircle className="h-4 w-4" />
                                Salah
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2">
                          <p className="text-slate-600">
                            Jawaban Peserta:{' '}
                            <span className="font-semibold text-slate-900">
                              {chosenIdx !== null
                                ? `${String.fromCharCode(65 + chosenIdx)}. ${
                                    q.pilihan[chosenIdx]
                                  }`
                                : 'Tidak dijawab'}
                            </span>
                          </p>
                          <p className="text-emerald-700">
                            Kunci Jawaban:{' '}
                            <span className="font-semibold">
                              {String.fromCharCode(65 + q.kunciJawaban)}.{' '}
                              {q.pilihan[q.kunciJawaban]}
                            </span>
                          </p>
                        </div>
                        {q.pembahasan && (
                          <p className="mt-2 text-xs text-slate-600">
                            Pembahasan: {q.pembahasan}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={() => setSessionStatus('idle')}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    Kembali ke Pemilihan Soal
                  </button>
                </div>
              </div>
            )}
        </div>
      )}

      {/* TAB 1: QUIZ & QUESTION BUILDER */}
      {activeTab === 'buat-soal' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <form
            onSubmit={handleCreateQuiz}
            className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 lg:col-span-8"
          >
            <h2 className="text-base font-semibold text-slate-900">
              Buat Paket Soal Modular & Kunci Jawaban Otomatis
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Judul Evaluasi / Ujian
                </label>
                <input
                  type="text"
                  required
                  value={judul}
                  onChange={(e) => setJudul(e.target.value)}
                  placeholder="Mis. Evaluasi Modul 4 Ekonomi Kreatif"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Mata Pelajaran / Bidang Kompetensi
                </label>
                <input
                  type="text"
                  required
                  value={mataPelajaran}
                  onChange={(e) => setMataPelajaran(e.target.value)}
                  placeholder="Mis. Kewirausahaan"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Kaitkan ke Modul Pembelajaran
                </label>
                <select
                  value={moduleId}
                  onChange={(e) => setModuleId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                >
                  <option value="">Umum / Tanpa Modul Khusus</option>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.kode} — {m.judul}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Jalur SKK Pembelajaran
                </label>
                <select
                  value={modePembelajaran}
                  onChange={(e) =>
                    setModePembelajaran(e.target.value as LearningMode)
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                >
                  <option value="Tatap Muka">Tatap Muka</option>
                  <option value="Tutorial">Tutorial</option>
                  <option value="Mandiri">Mandiri</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">
                  Program Sasaran
                </label>
                <select
                  value={program}
                  onChange={(e) =>
                    setProgram(e.target.value as ProgramType | 'Semua Program')
                  }
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                >
                  <option value="Semua Program">Semua Program</option>
                  <option value="Paket A">Paket A</option>
                  <option value="Paket B">Paket B</option>
                  <option value="Paket C">Paket C</option>
                  <option value="Kursus Vokasi">Kursus Vokasi</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Target KKM
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={100}
                    value={targetNilai}
                    onChange={(e) => setTargetNilai(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Batas (Menit)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={durasiMenit}
                    onChange={(e) => setDurasiMenit(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Tutor Penyusun
                </label>
                <input
                  type="text"
                  value={tutorPembuat}
                  onChange={(e) => setTutorPembuat(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-4 border-t border-slate-200 pt-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">
                  Daftar Butir Soal ({draftQuestions.length})
                </h3>
                <button
                  type="button"
                  onClick={addDraftQuestion}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Tambah Butir Soal</span>
                </button>
              </div>

              {draftQuestions.map((q, qIdx) => (
                <div
                  key={q.id}
                  className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-slate-700">
                      Soal #{qIdx + 1}
                    </span>
                    {draftQuestions.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setDraftQuestions((prev) =>
                            prev.filter((_, i) => i !== qIdx)
                          )
                        }
                        className="text-xs font-medium text-red-600 hover:underline"
                      >
                        Hapus Soal
                      </button>
                    )}
                  </div>

                  <textarea
                    rows={2}
                    required
                    value={q.pertanyaan}
                    onChange={(e) =>
                      updateDraftQuestion(qIdx, { pertanyaan: e.target.value })
                    }
                    placeholder="Tuliskan pertanyaan di sini..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                  />

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {q.pilihan.map((opt, optIdx) => {
                      const letter = String.fromCharCode(65 + optIdx);
                      const isKey = q.kunciJawaban === optIdx;
                      return (
                        <div
                          key={optIdx}
                          className={`flex items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5 ${
                            isKey ? 'border-emerald-600' : 'border-slate-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`key-${q.id}`}
                            checked={isKey}
                            onChange={() =>
                              updateDraftQuestion(qIdx, { kunciJawaban: optIdx })
                            }
                            title="Pilih sebagai kunci jawaban"
                            className="h-4 w-4 text-emerald-600"
                          />
                          <span className="font-mono text-xs font-semibold text-slate-500">
                            {letter}.
                          </span>
                          <input
                            type="text"
                            required
                            value={opt}
                            onChange={(e) =>
                              updateDraftOption(qIdx, optIdx, e.target.value)
                            }
                            placeholder={`Opsi ${letter}`}
                            className="w-full bg-transparent text-xs text-slate-800 focus:outline-none"
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        value={q.pembahasan}
                        onChange={(e) =>
                          updateDraftQuestion(qIdx, {
                            pembahasan: e.target.value,
                          })
                        }
                        placeholder="Pembahasan singkat kunci jawaban (opsional)"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600 whitespace-nowrap">
                        Bobot:
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={q.bobot}
                        onChange={(e) =>
                          updateDraftQuestion(qIdx, {
                            bobot: Number(e.target.value),
                          })
                        }
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-xs focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end border-t border-slate-200 pt-4">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800"
              >
                <ListChecks className="h-4 w-4" />
                <span>Simpan Paket Soal ke Bank Soal</span>
              </button>
            </div>
          </form>

          <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-4">
            <h2 className="text-base font-semibold text-slate-900">
              Bank Soal Tersimpan
            </h2>
            <div className="mt-4 space-y-3">
              {quizzes.map((q) => (
                <div
                  key={q.id}
                  className="rounded-lg border border-slate-200 p-3.5 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">
                        {q.isRemedial && (
                          <span className="mr-1 text-red-700">[Remidial]</span>
                        )}
                        {q.judul}
                      </p>
                      <p className="mt-0.5 text-slate-500">
                        {q.mataPelajaran} · {q.modePembelajaran} · {q.program}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-slate-600 tabular-nums">
                        {q.soal.length} soal · KKM {q.targetNilai} ·{' '}
                        {q.durasiMenit} mnt
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteQuiz(q.id)}
                      className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      aria-label={`Hapus paket ${q.judul}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('pengerjaan');
                        startQuizSession(q.id);
                      }}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50"
                    >
                      <Play className="h-3 w-3" />
                      <span>Jalankan Evaluasi</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INDIVIDUAL ATTEMPT RESULTS */}
      {activeTab === 'hasil' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              Rekaman skor, jalur SKK, status ketuntasan, dan rincian durasi pengerjaan setiap individu.
            </p>
            <select
              value={historyLearnerFilter}
              onChange={(e) => setHistoryLearnerFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            >
              <option value="Semua">Semua Warga Belajar</option>
              {learners.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nama}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                    <th className="px-6 py-3">Warga Belajar</th>
                    <th className="px-4 py-3">Evaluasi & Jalur SKK</th>
                    <th className="px-4 py-3">Tanggal</th>
                    <th className="px-4 py-3 text-right">Benar</th>
                    <th className="px-4 py-3 text-right">Durasi Total</th>
                    <th className="px-4 py-3 text-right">Skor / KKM</th>
                    <th className="px-6 py-3 text-right">Rincian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredAttempts.map((att) => {
                    const isExpanded = expandedAttemptId === att.id;
                    return (
                      <React.Fragment key={att.id}>
                        <tr className="hover:bg-slate-50/70">
                          <td className="px-6 py-3.5 font-medium text-slate-900">
                            {att.learnerNama}
                          </td>
                          <td className="px-4 py-3.5 text-xs">
                            <div className="font-medium text-slate-800">
                              {att.quizJudul}
                            </div>
                            <div className="text-slate-500">
                              {att.mataPelajaran} · {att.modePembelajaran}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-mono text-xs text-slate-600 tabular-nums">
                            {att.tanggalPengerjaan.slice(0, 10)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-700 tabular-nums">
                            {att.totalBenar}/{att.totalSoal}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-700 tabular-nums">
                            {formatClock(att.totalDurasiDetik)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums">
                            <span
                              className={`font-bold ${
                                att.tuntas ? 'text-emerald-700' : 'text-red-700'
                              }`}
                            >
                              {att.skor}
                            </span>
                            <span className="text-slate-400">
                              /{att.targetNilai}
                            </span>
                            <div className="text-[11px]">
                              {att.tuntas ? (
                                <span className="text-emerald-700">Tuntas</span>
                              ) : (
                                <span className="text-red-700">Belum Tuntas</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedAttemptId(isExpanded ? null : att.id)
                              }
                              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                              {isExpanded ? 'Tutup' : 'Audit Soal'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50/70">
                            <td colSpan={7} className="px-6 py-4">
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
                                {att.detailSoal.map((d, i) => (
                                  <div
                                    key={d.questionId}
                                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
                                  >
                                    <div className="flex items-center justify-between font-mono tabular-nums">
                                      <span className="font-semibold text-slate-700">
                                        Soal #{i + 1}
                                      </span>
                                      <span
                                        className={
                                          d.benar
                                            ? 'font-semibold text-emerald-700'
                                            : 'font-semibold text-red-700'
                                        }
                                      >
                                        {d.benar ? 'Benar' : 'Salah'}
                                      </span>
                                    </div>
                                    <p className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                                      Durasi: {d.durasiDetik} detik · Pilihan:{' '}
                                      {d.jawabanDipilih !== null
                                        ? String.fromCharCode(
                                            65 + d.jawabanDipilih
                                          )
                                        : '—'}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
