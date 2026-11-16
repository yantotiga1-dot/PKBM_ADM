import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  Bell,
  BookOpenCheck,
  Building2,
  CalendarCheck2,
  CheckCircle2,
  ExternalLink,
  FileBarChart2,
  FileSpreadsheet,
  FolderOpen,
  Globe2,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  QrCode,
  RefreshCw,
  Settings,
  UploadCloud,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  INITIAL_ATTEMPTS,
  INITIAL_ATTENDANCE,
  INITIAL_DOCUMENTS,
  INITIAL_INSTITUTIONS,
  INITIAL_LEARNERS,
  INITIAL_LEAVE_REQUESTS,
  INITIAL_MODULES,
  INITIAL_NOTIFICATIONS,
  INITIAL_QUIZZES,
} from './data/seedData';
import {
  clearAccessToken,
  getAccessToken,
  googleSignIn,
  initAuth,
  logout,
} from './services/googleAuth';
import {
  deleteDriveFile,
  ensureWorkspaceResources,
  incrementalSyncToSheets,
  loadFromSheets,
  previewIncrementalDelta,
  sendTutorAlertEmail,
  uploadFileToDrive,
  uploadTextReportToDrive,
  WorkspaceDataset,
} from './services/googleWorkspace';
import {
  enqueueOfflineAttendance,
  getAllOfflineAttendance,
  getPendingOfflineAttendance,
  getSyncBaseline,
  markOfflineAttendanceSynced,
  saveSyncBaseline,
} from './services/offlineDb';
import {
  ActiveView,
  AttendanceRecord,
  DocumentCategory,
  Institution,
  Learner,
  LearnerDocument,
  LearningMode,
  LearningModule,
  LeaveRequest,
  Quiz,
  QuizAttempt,
  SyncBaseline,
  TutorNotification,
} from './types';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { AttendanceTracker } from './components/AttendanceTracker';
import { ConfirmDialog } from './components/ConfirmDialog';
import { DinasDashboard } from './components/DinasDashboard';
import { DocumentVault } from './components/DocumentVault';
import { GoogleSignInButton } from './components/GoogleSignInButton';
import { IdCardPrinter } from './components/IdCardPrinter';
import { InstitutionSettings } from './components/InstitutionSettings';
import { LearnerManagement } from './components/LearnerManagement';
import { LearnerPortal } from './components/LearnerPortal';
import { ModuleManager } from './components/ModuleManager';
import { ProgressReports } from './components/ProgressReports';
import { QuizSystem } from './components/QuizSystem';
import { TutorNotifications } from './components/TutorNotifications';

const STORAGE_KEY = 'lentera_belajar_multi_v2';

interface PersistedAppState {
  institutions: Institution[];
  activeInstitutionId: string;
  learners: Learner[];
  documents: LearnerDocument[];
  attendance: AttendanceRecord[];
  modules: LearningModule[];
  quizzes: Quiz[];
  attempts: QuizAttempt[];
  leaveRequests: LeaveRequest[];
  notifications: TutorNotification[];
}

function loadPersistedState(): PersistedAppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedAppState>;
      return {
        institutions: parsed.institutions?.length
          ? parsed.institutions
          : INITIAL_INSTITUTIONS,
        activeInstitutionId:
          parsed.activeInstitutionId || INITIAL_INSTITUTIONS[0].id,
        learners: parsed.learners?.length ? parsed.learners : INITIAL_LEARNERS,
        documents: parsed.documents || INITIAL_DOCUMENTS,
        attendance: parsed.attendance?.length
          ? parsed.attendance
          : INITIAL_ATTENDANCE,
        modules: parsed.modules?.length ? parsed.modules : INITIAL_MODULES,
        quizzes: parsed.quizzes?.length ? parsed.quizzes : INITIAL_QUIZZES,
        attempts: parsed.attempts || INITIAL_ATTEMPTS,
        leaveRequests: parsed.leaveRequests || INITIAL_LEAVE_REQUESTS,
        notifications: parsed.notifications || INITIAL_NOTIFICATIONS,
      };
    }
  } catch {
    // fallback to seed
  }
  return {
    institutions: INITIAL_INSTITUTIONS,
    activeInstitutionId: INITIAL_INSTITUTIONS[0].id,
    learners: INITIAL_LEARNERS,
    documents: INITIAL_DOCUMENTS,
    attendance: INITIAL_ATTENDANCE,
    modules: INITIAL_MODULES,
    quizzes: INITIAL_QUIZZES,
    attempts: INITIAL_ATTEMPTS,
    leaveRequests: INITIAL_LEAVE_REQUESTS,
    notifications: INITIAL_NOTIFICATIONS,
  };
}

interface PendingConfirmState {
  title: string;
  description: string;
  details?: string[];
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  action: () => Promise<void>;
}

export default function App() {
  const initialState = useMemo(() => loadPersistedState(), []);

  const initialVerifyParam = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    return params.get('verify');
  }, []);

  const [activeView, setActiveView] = useState<ActiveView>(
    initialVerifyParam ? 'cards' : 'dashboard'
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Multi-institution & Domain State
  const [institutions, setInstitutions] = useState<Institution[]>(
    initialState.institutions
  );
  const [activeInstitutionId, setActiveInstitutionId] = useState<string>(
    initialState.activeInstitutionId
  );
  const [learners, setLearners] = useState<Learner[]>(initialState.learners);
  const [documents, setDocuments] = useState<LearnerDocument[]>(
    initialState.documents
  );
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(
    initialState.attendance
  );
  const [modules, setModules] = useState<LearningModule[]>(
    initialState.modules
  );
  const [quizzes, setQuizzes] = useState<Quiz[]>(initialState.quizzes);
  const [attempts, setAttempts] = useState<QuizAttempt[]>(initialState.attempts);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(
    initialState.leaveRequests
  );
  const [notifications, setNotifications] = useState<TutorNotification[]>(
    initialState.notifications
  );

  // Sub-navigation state
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(
    null
  );
  const [cardTargetLearnerId, setCardTargetLearnerId] = useState<string | null>(
    initialVerifyParam
  );
  const [quizDefaultTab, setQuizDefaultTab] = useState<
    'buat-soal' | 'pengerjaan' | 'hasil'
  >('pengerjaan');
  const [quizPreselectedLearnerId, setQuizPreselectedLearnerId] = useState<
    string | null
  >(null);
  const [quizPreselectedQuizId, setQuizPreselectedQuizId] = useState<
    string | null
  >(null);

  // Auth & Sync State
  const [user, setUser] = useState<User | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncBaseline, setSyncBaseline] = useState<SyncBaseline | null>(null);

  // Offline-first IndexedDB State
  const [isOnlineBrowser, setIsOnlineBrowser] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [isOfflineSimulated, setIsOfflineSimulated] = useState(false);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);

  // Toast, Confirmation & WhatsApp Dispatch Modal
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [confirmState, setConfirmState] = useState<PendingConfirmState | null>(
    null
  );
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [waPreviewModal, setWaPreviewModal] = useState<{
    notif: TutorNotification;
    url: string;
    message: string;
  } | null>(null);

  const activeInstitution = useMemo(
    () =>
      institutions.find((i) => i.id === activeInstitutionId) || institutions[0],
    [institutions, activeInstitutionId]
  );

  // Scoped datasets for the active institution
  const instLearners = useMemo(
    () => learners.filter((l) => l.institutionId === activeInstitution.id),
    [learners, activeInstitution.id]
  );
  const instDocuments = useMemo(
    () => documents.filter((d) => d.institutionId === activeInstitution.id),
    [documents, activeInstitution.id]
  );
  const instAttendance = useMemo(
    () => attendance.filter((a) => a.institutionId === activeInstitution.id),
    [attendance, activeInstitution.id]
  );
  const instModules = useMemo(
    () => modules.filter((m) => m.institutionId === activeInstitution.id),
    [modules, activeInstitution.id]
  );
  const instQuizzes = useMemo(
    () => quizzes.filter((q) => q.institutionId === activeInstitution.id),
    [quizzes, activeInstitution.id]
  );
  const instAttempts = useMemo(
    () => attempts.filter((a) => a.institutionId === activeInstitution.id),
    [attempts, activeInstitution.id]
  );
  const instLeaveRequests = useMemo(
    () => leaveRequests.filter((lr) => lr.institutionId === activeInstitution.id),
    [leaveRequests, activeInstitution.id]
  );
  const instNotifications = useMemo(
    () => notifications.filter((n) => n.institutionId === activeInstitution.id),
    [notifications, activeInstitution.id]
  );

  const instDataset: WorkspaceDataset = useMemo(
    () => ({
      learners: instLearners,
      documents: instDocuments,
      attendance: instAttendance,
      modules: instModules,
      quizzes: instQuizzes,
      attempts: instAttempts,
      leaveRequests: instLeaveRequests,
      notifications: instNotifications,
    }),
    [
      instLearners,
      instDocuments,
      instAttendance,
      instModules,
      instQuizzes,
      instAttempts,
      instLeaveRequests,
      instNotifications,
    ]
  );

  const deltaPreview = useMemo(
    () => previewIncrementalDelta(instDataset, syncBaseline?.hashes || {}),
    [instDataset, syncBaseline]
  );

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToast({ type, text });
  };

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5500);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Persist non-sensitive domain data
  useEffect(() => {
    try {
      const payload: PersistedAppState = {
        institutions,
        activeInstitutionId,
        learners,
        documents,
        attendance,
        modules,
        quizzes,
        attempts,
        leaveRequests,
        notifications,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota error
    }
  }, [
    institutions,
    activeInstitutionId,
    learners,
    documents,
    attendance,
    modules,
    quizzes,
    attempts,
    leaveRequests,
    notifications,
  ]);

  // Load IndexedDB sync baseline & pending offline attendance on institution switch
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [baseline, pending, allOffline] = await Promise.all([
        getSyncBaseline(activeInstitution.id),
        getPendingOfflineAttendance(activeInstitution.id),
        getAllOfflineAttendance(activeInstitution.id),
      ]);
      if (cancelled) return;
      setSyncBaseline(baseline);
      setPendingOfflineCount(pending.length);
      if (allOffline.length > 0) {
        setAttendance((prev) => {
          const map = new Map<string, AttendanceRecord>();
          prev.forEach((a) => map.set(a.id, a));
          allOffline.forEach((o) => {
            if (o.pendingSync || !map.has(o.id)) map.set(o.id, o);
          });
          return Array.from(map.values());
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeInstitution.id]);

  // Browser online/offline listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnlineBrowser(true);
    };
    const handleOffline = () => {
      setIsOnlineBrowser(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-flush IndexedDB offline queue when back online
  const handleSyncOfflineQueue = async () => {
    const pending = await getPendingOfflineAttendance(activeInstitution.id);
    if (pending.length === 0) return;
    await markOfflineAttendanceSynced(pending.map((p) => p.id));
    setAttendance((prev) =>
      prev.map((a) =>
        pending.some((p) => p.id === a.id) ? { ...a, pendingSync: false } : a
      )
    );
    setPendingOfflineCount(0);
    showToast(
      'success',
      `${pending.length} data presensi dari IndexedDB offline berhasil disinkronkan.`
    );
  };

  useEffect(() => {
    if (isOnlineBrowser && !isOfflineSimulated && pendingOfflineCount > 0) {
      void handleSyncOfflineQueue();
    }
  }, [isOnlineBrowser, isOfflineSimulated]);

  // Firebase Auth listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (authedUser) => {
        setUser(authedUser);
        setNeedsAuth(false);
      },
      (maybeUser) => {
        setUser(maybeUser);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const requireToken = (): string | null => {
    const token = getAccessToken();
    if (!token) {
      setNeedsAuth(true);
      showToast(
        'error',
        'Sesi akses Google Workspace belum aktif. Silakan klik "Sign in with Google".'
      );
      return null;
    }
    return token;
  };

  const updateInstitutionConfig = (
    instId: string,
    cfg: Institution['workspaceConfig']
  ) => {
    setInstitutions((prev) =>
      prev.map((inst) =>
        inst.id === instId ? { ...inst, workspaceConfig: cfg } : inst
      )
    );
  };

  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setNeedsAuth(false);
        setIsSyncing(true);
        const cfg = await ensureWorkspaceResources(
          res.accessToken,
          activeInstitution.workspaceConfig?.spreadsheetId,
          activeInstitution.workspaceConfig?.driveFolderId,
          activeInstitution.nama
        );
        updateInstitutionConfig(activeInstitution.id, {
          ...cfg,
          lastSyncedAt: activeInstitution.workspaceConfig?.lastSyncedAt,
        });
        showToast(
          'success',
          `Terhubung ke Google Sheets, Drive & Gmail untuk ${activeInstitution.nama}.`
        );
      }
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'Gagal masuk dengan akun Google.'
      );
    } finally {
      setIsLoggingIn(false);
      setIsSyncing(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setNeedsAuth(true);
    showToast('info', 'Sesi Google Workspace diakhiri.');
  };

  const handleProvisionWorkspaceForInst = async (
    customSpreadsheetId?: string,
    customFolderId?: string
  ) => {
    const token = requireToken();
    if (!token) return;
    setIsSyncing(true);
    try {
      const cfg = await ensureWorkspaceResources(
        token,
        customSpreadsheetId,
        customFolderId,
        activeInstitution.nama
      );
      updateInstitutionConfig(activeInstitution.id, cfg);
      showToast(
        'success',
        `Resource Google Sheets & Drive untuk ${activeInstitution.nama} berhasil dihubungkan.`
      );
    } catch (err) {
      showToast(
        'error',
        err instanceof Error ? err.message : 'Gagal menghubungkan resource.'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  // --- INCREMENTAL DELTA SYNC TO GOOGLE SHEETS (WITH CONFIRMATION) ---
  const requestIncrementalSync = () => {
    const token = requireToken();
    if (!token) return;

    const totalChanges = deltaPreview.newCount + deltaPreview.changedCount;
    setConfirmState({
      title: `Jalankan Incremental Sync (${activeInstitution.nama})?`,
      description:
        totalChanges === 0
          ? 'Seluruh data lembaga ini sudah sama dengan snapshot terakhir di Google Sheets.'
          : 'Hanya baris baru dan baris yang mengalami perubahan yang akan dikirim ke Google Sheets (delta update), sehingga cepat dan aman dari timeout.',
      details: [
        `Spreadsheet ID: ${
          activeInstitution.workspaceConfig?.spreadsheetId ||
          'Akan dibuat otomatis'
        }`,
        `Baris baru ditambahkan: ${deltaPreview.newCount}`,
        `Baris diubah diperbarui: ${deltaPreview.changedCount}`,
        `Baris identik dilewati: ${deltaPreview.unchangedCount}`,
      ],
      confirmLabel: 'Sinkronkan Delta Sekarang',
      tone: 'primary',
      action: async () => {
        const activeToken = requireToken();
        if (!activeToken) return;
        let cfg = activeInstitution.workspaceConfig;
        if (!cfg?.spreadsheetId) {
          cfg = await ensureWorkspaceResources(
            activeToken,
            undefined,
            undefined,
            activeInstitution.nama
          );
          updateInstitutionConfig(activeInstitution.id, cfg);
        }
        const res = await incrementalSyncToSheets(
          activeToken,
          cfg.spreadsheetId,
          instDataset,
          syncBaseline?.hashes || {}
        );
        const nextBaseline: SyncBaseline = {
          institutionId: activeInstitution.id,
          hashes: res.nextHashes,
          lastDeltaSummary: {
            timestamp: res.syncedAt,
            updatedRows: res.updatedRows,
            appendedRows: res.appendedRows,
            skippedRows: res.skippedRows,
          },
        };
        await saveSyncBaseline(nextBaseline);
        setSyncBaseline(nextBaseline);
        updateInstitutionConfig(activeInstitution.id, {
          ...cfg,
          lastSyncedAt: res.syncedAt,
        });
        showToast(
          'success',
          `Incremental Sync selesai: +${res.appendedRows} baru, ${res.updatedRows} diperbarui, ${res.skippedRows} dilewati.`
        );
      },
    });
  };

  const handleLoadFromSheets = async () => {
    const token = requireToken();
    if (!token) return;
    const sheetId = activeInstitution.workspaceConfig?.spreadsheetId;
    if (!sheetId) {
      showToast('error', 'Spreadsheet lembaga belum dikonfigurasi.');
      return;
    }

    setIsSyncing(true);
    try {
      const loaded = await loadFromSheets(token, sheetId, activeInstitution.id);
      const replaceInst = <T extends { institutionId: string }>(
        current: T[],
        incoming?: T[]
      ): T[] => {
        if (!incoming) return current;
        return [
          ...current.filter((x) => x.institutionId !== activeInstitution.id),
          ...incoming,
        ];
      };
      if (loaded.learners?.length)
        setLearners((prev) => replaceInst(prev, loaded.learners));
      if (loaded.documents)
        setDocuments((prev) => replaceInst(prev, loaded.documents));
      if (loaded.attendance)
        setAttendance((prev) => replaceInst(prev, loaded.attendance));
      if (loaded.modules?.length)
        setModules((prev) => replaceInst(prev, loaded.modules));
      if (loaded.quizzes?.length)
        setQuizzes((prev) => replaceInst(prev, loaded.quizzes));
      if (loaded.attempts)
        setAttempts((prev) => replaceInst(prev, loaded.attempts));
      if (loaded.leaveRequests)
        setLeaveRequests((prev) => replaceInst(prev, loaded.leaveRequests));
      if (loaded.notifications)
        setNotifications((prev) => replaceInst(prev, loaded.notifications));

      showToast(
        'success',
        `Data ${activeInstitution.nama} berhasil dimuat dari Google Sheets.`
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Gagal memuat data Spreadsheet.';
      if (msg.includes('401')) {
        clearAccessToken();
        setNeedsAuth(true);
      }
      showToast('error', msg);
    } finally {
      setIsSyncing(false);
    }
  };

  // --- GOOGLE DRIVE DOCUMENT HANDLERS ---
  const handleUploadDocument = async ({
    learner,
    kategori,
    catatan,
    file,
  }: {
    learner: Learner;
    kategori: DocumentCategory;
    catatan: string;
    file: File;
  }) => {
    const sizeKb = Math.round(file.size / 1024);
    const ukuranLabel =
      sizeKb >= 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`;

    const token = getAccessToken();
    if (!token) {
      throw new Error(
        'Silakan klik "Sign in with Google" terlebih dahulu untuk mengunggah dokumen ke Google Drive.'
      );
    }

    let cfg = activeInstitution.workspaceConfig;
    if (!cfg?.driveFolderId) {
      cfg = await ensureWorkspaceResources(
        token,
        cfg?.spreadsheetId,
        cfg?.driveFolderId,
        activeInstitution.nama
      );
      updateInstitutionConfig(activeInstitution.id, cfg);
    }

    const uploaded = await uploadFileToDrive(
      token,
      cfg.driveFolderId,
      file,
      `${learner.id}_${kategori.replace(/[^a-zA-Z0-9]/g, '_')}_${file.name}`
    );

    const newDoc: LearnerDocument = {
      id: `DOC-${Date.now().toString().slice(-5)}`,
      institutionId: activeInstitution.id,
      learnerId: learner.id,
      learnerNama: learner.nama,
      kategori,
      namaFile: uploaded.name,
      mimeType: uploaded.mimeType,
      ukuranLabel,
      tanggalUnggah: new Date().toISOString().slice(0, 10),
      driveFileId: uploaded.id,
      driveWebViewLink: uploaded.webViewLink,
      statusSinkron: 'Tersimpan di Drive',
      catatan,
    };
    setDocuments((prev) => [newDoc, ...prev]);
    showToast(
      'success',
      `Dokumen "${uploaded.name}" berhasil diunggah ke Google Drive.`
    );
  };

  const handleDeleteDocument = (doc: LearnerDocument) => {
    setConfirmState({
      title: 'Hapus Dokumen Warga Belajar?',
      description: doc.driveFileId
        ? `File "${doc.namaFile}" akan dihapus secara permanen dari Google Drive dan daftar arsip.`
        : `Hapus catatan dokumen "${doc.namaFile}" dari daftar arsip aplikasi?`,
      details: [
        `Warga Belajar: ${doc.learnerNama}`,
        `Kategori: ${doc.kategori}`,
        ...(doc.driveFileId ? [`Drive File ID: ${doc.driveFileId}`] : []),
      ],
      confirmLabel: 'Hapus Dokumen',
      tone: 'danger',
      action: async () => {
        if (doc.driveFileId) {
          const token = requireToken();
          if (!token) return;
          await deleteDriveFile(token, doc.driveFileId);
        }
        setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
        showToast('success', `Dokumen "${doc.namaFile}" berhasil dihapus.`);
      },
    });
  };

  const handleSaveReportToDrive = (fileName: string, csvContent: string) => {
    const token = requireToken();
    if (!token) return;

    setConfirmState({
      title: 'Simpan Laporan Kemajuan ke Google Drive?',
      description:
        'Laporan periode terpilih akan diunggah sebagai file CSV ke folder Google Drive lembaga.',
      details: [
        `Lembaga: ${activeInstitution.nama}`,
        `Nama File: ${fileName}`,
      ],
      confirmLabel: 'Simpan ke Drive',
      tone: 'primary',
      action: async () => {
        const activeToken = requireToken();
        if (!activeToken) return;
        let cfg = activeInstitution.workspaceConfig;
        if (!cfg?.driveFolderId) {
          cfg = await ensureWorkspaceResources(
            activeToken,
            undefined,
            undefined,
            activeInstitution.nama
          );
          updateInstitutionConfig(activeInstitution.id, cfg);
        }
        await uploadTextReportToDrive(
          activeToken,
          cfg.driveFolderId,
          fileName,
          csvContent,
          'text/csv;charset=utf-8'
        );
        showToast(
          'success',
          `Laporan "${fileName}" disimpan ke Drive ${activeInstitution.nama}.`
        );
      },
    });
  };

  // --- AUTO-REMEDIAL QUIZ GENERATOR ---
  const createRemedialQuizForLearner = (
    learner: Learner,
    sourceQuiz: Quiz,
    failedDetailIds?: string[]
  ): Quiz => {
    const missedQuestions = failedDetailIds?.length
      ? sourceQuiz.soal.filter((q) => failedDetailIds.includes(q.id))
      : sourceQuiz.soal;
    const selectedPool =
      missedQuestions.length > 0 ? missedQuestions : sourceQuiz.soal.slice(0, 2);

    const remedialQuiz: Quiz = {
      id: `REM-${Date.now().toString().slice(-5)}`,
      institutionId: learner.institutionId,
      moduleId: sourceQuiz.moduleId,
      judul: `Remidial: ${sourceQuiz.judul} (${learner.nama})`,
      mataPelajaran: sourceQuiz.mataPelajaran,
      program: learner.program,
      modePembelajaran: 'Mandiri',
      targetNilai: sourceQuiz.targetNilai,
      durasiMenit: Math.max(10, selectedPool.length * 3),
      tutorPembuat: learner.tutorNama,
      tanggalDibuat: new Date().toISOString().slice(0, 10),
      isRemedial: true,
      assignedLearnerIds: [learner.id],
      parentQuizId: sourceQuiz.id,
      soal: selectedPool.map((q, i) => ({
        ...q,
        id: `${q.id}-REM-${i + 1}`,
        bobot: Math.round(100 / selectedPool.length),
      })),
    };
    setQuizzes((prev) => [remedialQuiz, ...prev]);
    return remedialQuiz;
  };

  const handleGenerateRemedialFromAlert = (notif: TutorNotification) => {
    const learner = learners.find((l) => l.id === notif.learnerId);
    if (!learner) return;
    const matchingQuiz =
      instQuizzes.find(
        (q) => q.mataPelajaran === notif.kompetensi && !q.isRemedial
      ) || instQuizzes[0];
    if (!matchingQuiz) return;

    const rem = createRemedialQuizForLearner(learner, matchingQuiz);
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === notif.id ? { ...n, remedialQuizId: rem.id } : n
      )
    );
    showToast(
      'success',
      `Paket soal remidial (${rem.id}) otomatis diterbitkan ke Portal Mandiri ${learner.nama}.`
    );
  };

  // --- MULTI-CHANNEL ALERT: GMAIL & WHATSAPP ---
  const handleRequestSendEmail = (
    notif: TutorNotification,
    overrideEmail?: string
  ) => {
    const token = requireToken();
    if (!token) return;

    const recipient = (overrideEmail || notif.tutorEmail).trim();
    if (!recipient) {
      showToast('error', 'Alamat email tutor tidak boleh kosong.');
      return;
    }

    const subject = `[${activeInstitution.nama}] Peringatan EWS: ${notif.learnerNama}`;
    const bodyText = [
      `Yth. ${notif.tutorNama},`,
      '',
      `Sistem Early Warning System (EWS) ${activeInstitution.nama} mendeteksi:`,
      `- Warga Belajar : ${notif.learnerNama} (${notif.program})`,
      `- Kompetensi    : ${notif.kompetensi}`,
      `- Skor Capaian  : ${notif.skorCapaian} (Target KKM: ${notif.targetNilai})`,
      `- Tingkat Risiko: ${notif.riskLevel}`,
      `- Keterangan    : ${notif.pemicu}`,
      '',
      notif.remedialQuizId
        ? `Soal remidial otomatis (${notif.remedialQuizId}) telah diterbitkan di Portal Mandiri Warga Belajar.`
        : `Mohon jadwalkan pendampingan atau terbitkan soal remidial.`,
      '',
      `Salam,`,
      `${activeInstitution.channelSettings.senderAlias}`,
    ].join('\n');

    setConfirmState({
      title: 'Kirim Email Peringatan ke Tutor via Gmail?',
      description:
        'Email peringatan akan dikirim melalui akun Gmail Anda yang terhubung.',
      details: [
        `Penerima: ${recipient}`,
        `Subjek: ${subject}`,
        `Tingkat Risiko EWS: ${notif.riskLevel}`,
      ],
      confirmLabel: 'Kirim Email Sekarang',
      tone: 'primary',
      action: async () => {
        const activeToken = requireToken();
        if (!activeToken) return;
        await sendTutorAlertEmail(activeToken, recipient, subject, bodyText);
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notif.id
              ? {
                  ...n,
                  tutorEmail: recipient,
                  statusKirim: 'Terkirim via Gmail',
                  waktuTerkirim: new Date().toISOString(),
                }
              : n
          )
        );
        showToast('success', `Email notifikasi berhasil dikirim ke ${recipient}.`);
      },
    });
  };

  const handleOpenWhatsAppAlert = (notif: TutorNotification) => {
    const phone = (notif.tutorTelepon || '6281234567890').replace(/\D/g, '');
    const message = [
      `*PERINGATAN EWS — ${activeInstitution.nama}*`,
      `Yth. ${notif.tutorNama},`,
      `Warga Belajar: *${notif.learnerNama}* (${notif.program})`,
      `Kompetensi: ${notif.kompetensi}`,
      `Capaian: ${notif.skorCapaian} / Target ${notif.targetNilai}`,
      `Risiko: *${notif.riskLevel}*`,
      `Catatan: ${notif.pemicu}`,
      notif.remedialQuizId
        ? `Soal Remidial (${notif.remedialQuizId}) sudah aktif di Portal Siswa.`
        : `Mohon segera lakukan tindak lanjut pendampingan.`,
    ].join('\n');
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    setWaPreviewModal({ notif, url, message });
  };

  // --- QUIZ SUBMISSION & EWS AUTO-REMEDIAL ---
  const handleSubmitAttempt = (attempt: QuizAttempt) => {
    setAttempts((prev) => [attempt, ...prev]);

    if (!attempt.tuntas) {
      const learner = learners.find((l) => l.id === attempt.learnerId);
      const sourceQuiz = quizzes.find((q) => q.id === attempt.quizId);
      if (learner && sourceQuiz) {
        const lAtt = instAttendance.filter((a) => a.learnerId === learner.id);
        const hadir = lAtt.filter((a) => a.status === 'Hadir').length;
        const attRate =
          lAtt.length > 0 ? Math.round((hadir / lAtt.length) * 100) : 100;
        const isHighRisk = attRate < 75 || attempt.skor < attempt.targetNilai - 15;

        let remedialId: string | undefined;
        if (
          activeInstitution.channelSettings.autoPublishRemedial &&
          !sourceQuiz.isRemedial
        ) {
          const missedIds = attempt.detailSoal
            .filter((d) => !d.benar)
            .map((d) => d.questionId);
          const rem = createRemedialQuizForLearner(
            learner,
            sourceQuiz,
            missedIds
          );
          remedialId = rem.id;
        }

        const newNotif: TutorNotification = {
          id: `NOTIF-${Date.now().toString().slice(-5)}`,
          institutionId: learner.institutionId,
          learnerId: learner.id,
          learnerNama: learner.nama,
          program: learner.program,
          tutorNama: learner.tutorNama,
          tutorEmail: learner.tutorEmail,
          tutorTelepon: learner.tutorTelepon,
          kompetensi: attempt.mataPelajaran,
          skorCapaian: attempt.skor,
          targetNilai: attempt.targetNilai,
          riskLevel: isHighRisk ? 'Tinggi (Drop-Out)' : 'Sedang',
          pemicu: isHighRisk
            ? `EWS Risiko Tinggi: Nilai ${attempt.skor} (< KKM ${attempt.targetNilai}) · Kehadiran ${attRate}%`
            : `Evaluasi "${attempt.quizJudul}" di bawah KKM (${attempt.skor} vs ${attempt.targetNilai})`,
          waktuTerdeteksi: attempt.tanggalPengerjaan,
          statusKirim: 'Menunggu Tindakan',
          remedialQuizId: remedialId,
        };
        setNotifications((prev) => [newNotif, ...prev]);
        showToast(
          'info',
          `Skor ${learner.nama} (${attempt.skor}) di bawah KKM. EWS aktif & soal remidial diterbitkan.`
        );
      }
    } else {
      showToast(
        'success',
        `Evaluasi tuntas! ${attempt.learnerNama} memperoleh skor ${attempt.skor}.`
      );
    }
  };

  const handleScanCompetencies = (): number => {
    let added = 0;
    const newAlerts: TutorNotification[] = [];

    for (const learner of instLearners) {
      const lAttempts = instAttempts.filter((a) => a.learnerId === learner.id);
      const lAtt = instAttendance.filter((a) => a.learnerId === learner.id);
      const present = lAtt.filter((a) => a.status === 'Hadir').length;
      const attRate =
        lAtt.length > 0 ? Math.round((present / lAtt.length) * 100) : 100;

      const latestAvg =
        lAttempts.length > 0
          ? Math.round(
              lAttempts.reduce((s, a) => s + a.skor, 0) / lAttempts.length
            )
          : null;

      if (attRate < 75 && latestAvg !== null && latestAvg < learner.targetKompetensi) {
        const exists = instNotifications.some(
          (n) =>
            n.learnerId === learner.id && n.riskLevel === 'Tinggi (Drop-Out)'
        );
        if (!exists) {
          added++;
          newAlerts.push({
            id: `NOTIF-EWS-${Date.now().toString().slice(-4)}-${added}`,
            institutionId: activeInstitution.id,
            learnerId: learner.id,
            learnerNama: learner.nama,
            program: learner.program,
            tutorNama: learner.tutorNama,
            tutorEmail: learner.tutorEmail,
            tutorTelepon: learner.tutorTelepon,
            kompetensi: 'Kehadiran & Kompetensi Terpadu',
            skorCapaian: latestAvg,
            targetNilai: learner.targetKompetensi,
            riskLevel: 'Tinggi (Drop-Out)',
            pemicu: `EWS Drop-Out: Kehadiran ${attRate}% (<75%) dan rerata nilai ${latestAvg} (<${learner.targetKompetensi})`,
            waktuTerdeteksi: new Date().toISOString(),
            statusKirim: 'Menunggu Tindakan',
          });
        }
      }
    }

    if (newAlerts.length > 0) {
      setNotifications((prev) => [...newAlerts, ...prev]);
    }
    return added;
  };

  const handleUpsertAttendance = async (
    record: AttendanceRecord,
    forceOfflineQueue = false
  ) => {
    setAttendance((prev) => {
      const idx = prev.findIndex(
        (a) => a.tanggal === record.tanggal && a.learnerId === record.learnerId
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = record;
        return copy;
      }
      return [...prev, record];
    });

    if (forceOfflineQueue || isOfflineSimulated || !isOnlineBrowser) {
      await enqueueOfflineAttendance(record);
      const pending = await getPendingOfflineAttendance(activeInstitution.id);
      setPendingOfflineCount(pending.length);
    }
  };

  const handleResolveLeaveRequest = (id: string, approve: boolean) => {
    const req = leaveRequests.find((lr) => lr.id === id);
    setLeaveRequests((prev) =>
      prev.map((lr) =>
        lr.id === id ? { ...lr, status: approve ? 'Disetujui' : 'Ditolak' } : lr
      )
    );
    if (approve && req) {
      void handleUpsertAttendance({
        id: `ABS-${req.tanggal}-${req.learnerId}`,
        institutionId: req.institutionId,
        tanggal: req.tanggal,
        learnerId: req.learnerId,
        status: req.jenis,
        modePembelajaran: 'Tatap Muka',
        waktuCatat: '08:00',
        sumber: 'Pengajuan Mandiri',
        catatan: req.alasan,
      });
      showToast(
        'success',
        `Pengajuan ${req.jenis} ${req.learnerNama} disetujui dan masuk ke daftar presensi.`
      );
    }
  };

  const pendingAlertCount = useMemo(
    () =>
      instNotifications.filter((n) => n.statusKirim === 'Menunggu Tindakan')
        .length,
    [instNotifications]
  );

  const navGroups: Array<{
    group: string;
    items: Array<{
      id: ActiveView;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      badge?: number;
    }>;
  }> = [
    {
      group: 'Pengawasan & Lembaga',
      items: [
        { id: 'dinas', label: 'Dasbor Dinas', icon: Globe2 },
        { id: 'dashboard', label: 'Dasbor Lembaga', icon: LayoutDashboard },
      ],
    },
    {
      group: 'Operasional Akademik',
      items: [
        { id: 'learners', label: 'Warga Belajar', icon: Users },
        { id: 'modules', label: 'Modul & SKK', icon: Layers },
        { id: 'documents', label: 'Dokumen Drive', icon: FolderOpen },
        {
          id: 'attendance',
          label: 'Absensi Offline/QR',
          icon: CalendarCheck2,
          badge: pendingOfflineCount > 0 ? pendingOfflineCount : undefined,
        },
        { id: 'quizzes', label: 'Soal & Evaluasi', icon: BookOpenCheck },
        {
          id: 'notifications',
          label: 'EWS & Notifikasi',
          icon: Bell,
          badge: pendingAlertCount > 0 ? pendingAlertCount : undefined,
        },
        { id: 'reports', label: 'Laporan Otomatis', icon: FileBarChart2 },
        { id: 'cards', label: 'Kartu QR', icon: QrCode },
      ],
    },
    {
      group: 'Portal & Konfigurasi',
      items: [
        { id: 'portal', label: 'Portal Warga Belajar', icon: UserCheck },
        { id: 'settings', label: 'Atur Sheets & Lembaga', icon: Settings },
      ],
    },
  ];

  const currentNavLabel =
    navGroups
      .flatMap((g) => g.items)
      .find((i) => i.id === activeView)?.label || 'Dasbor Lembaga';

  const pendingDeltaTotal = deltaPreview.newCount + deltaPreview.changedCount;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-xs font-bold text-white">
              LB
            </div>
            <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
              Lentera Belajar
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
            aria-label="Tutup menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Active Institution Switcher inside Sidebar */}
        <div className="border-b border-slate-200 px-3 py-3">
          <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <Building2 className="h-3.5 w-3.5 text-blue-700" />
            <span>Lembaga Aktif</span>
          </label>
          <select
            value={activeInstitution.id}
            onChange={(e) => {
              setActiveInstitutionId(e.target.value);
              setSelectedLearnerId(null);
            }}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-blue-600 focus:outline-none"
          >
            {institutions.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.nama}
              </option>
            ))}
          </select>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.group} className="space-y-1">
              <p className="px-3 text-[11px] font-semibold text-slate-400">
                {group.group}
              </p>
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveView(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-blue-50 text-blue-800'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon
                        className={`h-4 w-4 shrink-0 ${
                          active ? 'text-blue-700' : 'text-slate-400'
                        }`}
                      />
                      <span>{item.label}</span>
                    </span>
                    {item.badge !== undefined && (
                      <span className="font-mono text-[11px] font-bold text-red-700 tabular-nums">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Google Workspace Footer */}
        <div className="border-t border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-700">
            Workspace ({activeInstitution.kode})
          </p>
          {needsAuth ? (
            <div className="mt-2 space-y-2">
              <GoogleSignInButton
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
              />
            </div>
          ) : (
            <div className="mt-2 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="truncate font-medium text-slate-800">
                  {user?.email || 'Terhubung'}
                </span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  title="Keluar akun Google"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
              {activeInstitution.workspaceConfig && (
                <div className="space-y-1 text-[11px]">
                  <a
                    href={activeInstitution.workspaceConfig.spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded border border-slate-200 px-2.5 py-1 text-slate-700 hover:bg-slate-50"
                  >
                    <span className="flex items-center gap-1.5">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                      Sheets Lembaga
                    </span>
                    <ExternalLink className="h-3 w-3 text-slate-400" />
                  </a>
                  <a
                    href={activeInstitution.workspaceConfig.driveFolderUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded border border-slate-200 px-2.5 py-1 text-slate-700 hover:bg-slate-50"
                  >
                    <span className="flex items-center gap-1.5">
                      <FolderOpen className="h-3.5 w-3.5 text-blue-700" />
                      Drive Lembaga
                    </span>
                    <ExternalLink className="h-3 w-3 text-slate-400" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-xs sm:px-8">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Buka menu navigasi"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="hidden text-slate-400 md:inline">
                {activeView === 'dinas'
                  ? 'Dinas Pendidikan'
                  : activeInstitution.nama}
              </span>
              <span className="hidden text-slate-300 md:inline">/</span>
              <span className="font-semibold text-slate-900 truncate">
                {currentNavLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {needsAuth ? (
              <GoogleSignInButton
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
              />
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleLoadFromSheets}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`}
                  />
                  <span>Muat Sheets</span>
                </button>
                <button
                  type="button"
                  onClick={requestIncrementalSync}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
                >
                  <UploadCloud className="h-3.5 w-3.5" />
                  <span className="font-mono tabular-nums">
                    Incremental Sync ({pendingDeltaTotal})
                  </span>
                </button>
              </>
            )}
          </div>
        </header>

        {/* Toast */}
        {toast && (
          <div className="no-print mx-auto mt-4 w-full max-w-7xl px-4 sm:px-8">
            <div
              className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-xs font-medium ${
                toast.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : toast.type === 'error'
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-blue-200 bg-blue-50 text-blue-800'
              }`}
            >
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{toast.text}</span>
              </span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="rounded p-0.5 hover:bg-black/5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Active View */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
          {activeView === 'dinas' && (
            <DinasDashboard
              institutions={institutions}
              learners={learners}
              attendance={attendance}
              attempts={attempts}
              modules={modules}
              notifications={notifications}
              onSwitchInstitution={(instId) => {
                setActiveInstitutionId(instId);
                setActiveView('dashboard');
              }}
            />
          )}

          {activeView === 'dashboard' && (
            <AnalyticsDashboard
              learners={instLearners}
              attendance={instAttendance}
              attempts={instAttempts}
              notifications={instNotifications}
              onInspectLearner={(id) => {
                setSelectedLearnerId(id);
                setActiveView('learners');
              }}
              onOpenCard={(id) => {
                setCardTargetLearnerId(id);
                setActiveView('cards');
              }}
              onOpenNotifications={() => setActiveView('notifications')}
              onStartQuiz={() => {
                setQuizDefaultTab('pengerjaan');
                setActiveView('quizzes');
              }}
            />
          )}

          {activeView === 'learners' && (
            <LearnerManagement
              institutionId={activeInstitution.id}
              learners={instLearners}
              documents={instDocuments}
              attendance={instAttendance}
              attempts={instAttempts}
              selectedLearnerId={selectedLearnerId}
              onSelectLearnerId={setSelectedLearnerId}
              onAddLearner={(l) => {
                setLearners((prev) => [...prev, l]);
                showToast('success', `Warga belajar ${l.nama} ditambahkan.`);
              }}
              onUpdateLearner={(l) => {
                setLearners((prev) =>
                  prev.map((item) => (item.id === l.id ? l : item))
                );
                showToast('success', `Data ${l.nama} diperbarui.`);
              }}
              onDeleteLearner={(id) => {
                const target = learners.find((l) => l.id === id);
                setConfirmState({
                  title: 'Hapus Data Warga Belajar?',
                  description: `Data profil ${
                    target?.nama || id
                  } akan dihapus dari daftar aktif lembaga.`,
                  confirmLabel: 'Hapus Data',
                  tone: 'danger',
                  action: async () => {
                    setLearners((prev) => prev.filter((l) => l.id !== id));
                    showToast('success', 'Data warga belajar dihapus.');
                  },
                });
              }}
              onOpenCard={(id) => {
                setCardTargetLearnerId(id);
                setActiveView('cards');
              }}
            />
          )}

          {activeView === 'modules' && (
            <ModuleManager
              institution={activeInstitution}
              modules={instModules}
              learners={instLearners}
              attendance={instAttendance}
              quizzes={instQuizzes}
              attempts={instAttempts}
              onAddModule={(mod) => {
                setModules((prev) => [mod, ...prev]);
                showToast('success', `Modul "${mod.judul}" ditambahkan.`);
              }}
              onStartModuleQuiz={(quizId) => {
                setQuizPreselectedQuizId(quizId);
                setQuizDefaultTab('pengerjaan');
                setActiveView('quizzes');
              }}
            />
          )}

          {activeView === 'documents' && (
            <DocumentVault
              learners={instLearners}
              documents={instDocuments}
              isWorkspaceConnected={!needsAuth}
              workspaceConfig={activeInstitution.workspaceConfig}
              onUploadDocument={handleUploadDocument}
              onDeleteDocument={handleDeleteDocument}
              onConnectWorkspace={handleGoogleLogin}
            />
          )}

          {activeView === 'attendance' && (
            <AttendanceTracker
              institutionId={activeInstitution.id}
              learners={instLearners}
              attendance={instAttendance}
              leaveRequests={instLeaveRequests}
              pendingOfflineCount={pendingOfflineCount}
              isOfflineSimulated={isOfflineSimulated}
              isOnlineBrowser={isOnlineBrowser}
              onToggleOfflineSim={() => setIsOfflineSimulated((v) => !v)}
              onSyncOfflineQueue={handleSyncOfflineQueue}
              onUpsertAttendance={handleUpsertAttendance}
              onBulkMarkPresent={(tanggal, learnerIds, modePembelajaran) => {
                setAttendance((prev) => {
                  const next = [...prev];
                  for (const lid of learnerIds) {
                    const idx = next.findIndex(
                      (a) => a.tanggal === tanggal && a.learnerId === lid
                    );
                    const rec: AttendanceRecord = {
                      id: `ABS-${tanggal}-${lid}`,
                      institutionId: activeInstitution.id,
                      tanggal,
                      learnerId: lid,
                      status: 'Hadir',
                      modePembelajaran,
                      waktuCatat: '08:00',
                      sumber: 'Manual',
                      catatan: '',
                    };
                    if (idx >= 0) next[idx] = rec;
                    else next.push(rec);
                  }
                  return next;
                });
                showToast(
                  'success',
                  `Seluruh warga belajar pada ${tanggal} (${modePembelajaran}) ditandai Hadir.`
                );
              }}
              onResolveLeaveRequest={handleResolveLeaveRequest}
            />
          )}

          {activeView === 'quizzes' && (
            <QuizSystem
              institutionId={activeInstitution.id}
              learners={instLearners}
              modules={instModules}
              quizzes={instQuizzes}
              attempts={instAttempts}
              initialTab={quizDefaultTab}
              preselectedLearnerId={quizPreselectedLearnerId}
              preselectedQuizId={quizPreselectedQuizId}
              onAddQuiz={(q) => {
                setQuizzes((prev) => [q, ...prev]);
                showToast('success', `Paket soal "${q.judul}" disimpan.`);
              }}
              onDeleteQuiz={(id) => {
                setQuizzes((prev) => prev.filter((q) => q.id !== id));
                showToast('info', 'Paket soal dihapus.');
              }}
              onSubmitAttempt={handleSubmitAttempt}
            />
          )}

          {activeView === 'notifications' && (
            <TutorNotifications
              notifications={instNotifications}
              isWorkspaceConnected={!needsAuth}
              onScanCompetencies={handleScanCompetencies}
              onRequestSendEmail={handleRequestSendEmail}
              onSendWhatsApp={handleOpenWhatsAppAlert}
              onGenerateRemedialForAlert={handleGenerateRemedialFromAlert}
              onMarkResolved={(id) => {
                setNotifications((prev) =>
                  prev.map((n) =>
                    n.id === id ? { ...n, statusKirim: 'Ditandai Selesai' } : n
                  )
                );
              }}
              onConnectWorkspace={handleGoogleLogin}
            />
          )}

          {activeView === 'reports' && (
            <ProgressReports
              learners={instLearners}
              attendance={instAttendance}
              attempts={instAttempts}
              isWorkspaceConnected={!needsAuth}
              onSaveReportToDrive={handleSaveReportToDrive}
            />
          )}

          {activeView === 'cards' && (
            <IdCardPrinter
              learners={instLearners}
              documents={instDocuments}
              attendance={instAttendance}
              attempts={instAttempts}
              initialLearnerId={cardTargetLearnerId}
              initialVerifyCode={initialVerifyParam}
            />
          )}

          {activeView === 'portal' && (
            <LearnerPortal
              institution={activeInstitution}
              learners={instLearners}
              modules={instModules}
              documents={instDocuments}
              attendance={instAttendance}
              quizzes={instQuizzes}
              attempts={instAttempts}
              leaveRequests={instLeaveRequests}
              onSubmitLeaveRequest={(req) => {
                setLeaveRequests((prev) => [req, ...prev]);
                showToast(
                  'success',
                  `Pengajuan ${req.jenis} tanggal ${req.tanggal} tercatat.`
                );
              }}
              onStartQuizAsLearner={(learnerId, quizId) => {
                setQuizPreselectedLearnerId(learnerId);
                setQuizPreselectedQuizId(quizId);
                setQuizDefaultTab('pengerjaan');
                setActiveView('quizzes');
              }}
            />
          )}

          {activeView === 'settings' && (
            <InstitutionSettings
              institutions={institutions}
              activeInstitution={activeInstitution}
              isWorkspaceConnected={!needsAuth}
              isLoggingIn={isLoggingIn}
              isSyncing={isSyncing}
              deltaPreview={deltaPreview}
              syncBaseline={syncBaseline}
              onSelectInstitution={(id) => {
                setActiveInstitutionId(id);
                setSelectedLearnerId(null);
              }}
              onAddInstitution={(inst) => {
                setInstitutions((prev) => [...prev, inst]);
                showToast(
                  'success',
                  `Lembaga "${inst.nama}" berhasil ditambahkan.`
                );
              }}
              onUpdateInstitution={(inst) => {
                setInstitutions((prev) =>
                  prev.map((i) => (i.id === inst.id ? inst : i))
                );
              }}
              onGoogleSignIn={handleGoogleLogin}
              onProvisionWorkspaceForInst={handleProvisionWorkspaceForInst}
              onRunIncrementalSync={requestIncrementalSync}
              onLoadFromSheets={handleLoadFromSheets}
            />
          )}
        </main>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={Boolean(confirmState)}
        title={confirmState?.title || ''}
        description={confirmState?.description || ''}
        details={confirmState?.details}
        confirmLabel={confirmState?.confirmLabel}
        tone={confirmState?.tone}
        loading={confirmLoading}
        onCancel={() => {
          if (!confirmLoading) setConfirmState(null);
        }}
        onConfirm={async () => {
          if (!confirmState) return;
          setConfirmLoading(true);
          try {
            await confirmState.action();
          } catch (err) {
            const msg =
              err instanceof Error ? err.message : 'Operasi gagal dijalankan.';
            if (msg.includes('401')) {
              clearAccessToken();
              setNeedsAuth(true);
            }
            showToast('error', msg);
          } finally {
            setConfirmLoading(false);
            setConfirmState(null);
          }
        }}
      />

      {/* WhatsApp Direct Alert Preview Modal (No window.open used) */}
      {waPreviewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">
              Pratinjau Pesan WhatsApp ke Tutor
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Penerima: {waPreviewModal.notif.tutorNama} (
              {waPreviewModal.notif.tutorTelepon || 'Nomor WhatsApp Tutor'})
            </p>
            <pre className="mt-4 whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50 p-3.5 font-sans text-xs leading-relaxed text-slate-800">
              {waPreviewModal.message}
            </pre>
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setWaPreviewModal(null)}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Tutup
              </button>
              <a
                href={waPreviewModal.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  const id = waPreviewModal.notif.id;
                  setNotifications((prev) =>
                    prev.map((n) =>
                      n.id === id
                        ? {
                            ...n,
                            statusKirim: 'Terkirim via WhatsApp',
                            waktuTerkirim: new Date().toISOString(),
                          }
                        : n
                    )
                  );
                  setWaPreviewModal(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-800"
              >
                <span>Buka WhatsApp & Tandai Terkirim</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
