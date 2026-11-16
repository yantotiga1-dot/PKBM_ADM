import {
  AttendanceRecord,
  GoogleWorkspaceConfig,
  Learner,
  LearnerDocument,
  LearningModule,
  LeaveRequest,
  Quiz,
  QuizAttempt,
  TutorNotification,
} from '../types';

export const SHEET_TABS = [
  'Warga_Belajar',
  'Dokumen_Drive',
  'Absensi_Harian',
  'Modul_Pembelajaran',
  'Bank_Soal',
  'Hasil_Evaluasi',
  'Pengajuan_Izin',
  'Notifikasi_Tutor',
] as const;

export type SheetTabName = (typeof SHEET_TABS)[number];

async function handleGoogleApiResponse(res: Response, fallbackMessage: string) {
  if (!res.ok) {
    let detail = fallbackMessage;
    try {
      const errJson = await res.json();
      detail = errJson?.error?.message || fallbackMessage;
    } catch {
      // ignore
    }
    throw new Error(`${fallbackMessage} (${res.status}: ${detail})`);
  }
  return res.json();
}

export async function ensureWorkspaceResources(
  accessToken: string,
  existingSpreadsheetId?: string,
  existingFolderId?: string,
  institutionName = 'Lentera Belajar'
): Promise<GoogleWorkspaceConfig> {
  const safeFolderName = `${institutionName} — Arsip Dokumen`;
  const safeSheetName = `${institutionName} — Data Terpadu`;

  // 1. Ensure Google Drive Folder
  let driveFolderId = '';
  let driveFolderUrl = '';

  if (existingFolderId) {
    const checkFolder = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
        existingFolderId
      )}?fields=id,name,webViewLink,trashed`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (checkFolder.ok) {
      const folderData = await checkFolder.json();
      if (!folderData.trashed) {
        driveFolderId = folderData.id;
        driveFolderUrl =
          folderData.webViewLink ||
          `https://drive.google.com/drive/folders/${folderData.id}`;
      }
    }
  }

  if (!driveFolderId) {
    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `name = '${safeFolderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
      )}&fields=files(id,name,webViewLink)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (searchRes.ok) {
      const searchJson = await searchRes.json();
      if (searchJson.files && searchJson.files.length > 0) {
        driveFolderId = searchJson.files[0].id;
        driveFolderUrl =
          searchJson.files[0].webViewLink ||
          `https://drive.google.com/drive/folders/${driveFolderId}`;
      }
    }
  }

  if (!driveFolderId) {
    const createFolderRes = await fetch(
      'https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: safeFolderName,
          mimeType: 'application/vnd.google-apps.folder',
        }),
      }
    );
    const createdFolder = await handleGoogleApiResponse(
      createFolderRes,
      'Gagal membuat folder arsip lembaga di Google Drive'
    );
    driveFolderId = createdFolder.id;
    driveFolderUrl =
      createdFolder.webViewLink ||
      `https://drive.google.com/drive/folders/${createdFolder.id}`;
  }

  // 2. Ensure Spreadsheet
  let spreadsheetId = '';
  let spreadsheetUrl = '';

  if (existingSpreadsheetId) {
    const checkSheet = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        existingSpreadsheetId
      )}?fields=spreadsheetId,spreadsheetUrl,properties.title`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (checkSheet.ok) {
      const sheetData = await checkSheet.json();
      spreadsheetId = sheetData.spreadsheetId;
      spreadsheetUrl =
        sheetData.spreadsheetUrl ||
        `https://docs.google.com/spreadsheets/d/${sheetData.spreadsheetId}`;
    }
  }

  if (!spreadsheetId) {
    const searchSheetRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
        `name = '${safeSheetName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`
      )}&fields=files(id,name,webViewLink)`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (searchSheetRes.ok) {
      const searchJson = await searchSheetRes.json();
      if (searchJson.files && searchJson.files.length > 0) {
        spreadsheetId = searchJson.files[0].id;
        spreadsheetUrl =
          searchJson.files[0].webViewLink ||
          `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
      }
    }
  }

  if (!spreadsheetId) {
    const createSheetRes = await fetch(
      'https://sheets.googleapis.com/v4/spreadsheets',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: {
            title: safeSheetName,
            locale: 'id_ID',
          },
          sheets: SHEET_TABS.map((title) => ({
            properties: { title },
          })),
        }),
      }
    );
    const createdSheet = await handleGoogleApiResponse(
      createSheetRes,
      'Gagal membuat Google Spreadsheet lembaga'
    );
    spreadsheetId = createdSheet.spreadsheetId;
    spreadsheetUrl =
      createdSheet.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${createdSheet.spreadsheetId}`;
  }

  return {
    spreadsheetId,
    spreadsheetUrl,
    driveFolderId,
    driveFolderUrl,
  };
}

async function ensureTabsExist(accessToken: string, spreadsheetId: string) {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await handleGoogleApiResponse(
    metaRes,
    'Gagal membaca metadata Google Spreadsheet'
  );
  const existingTitles = new Set<string>(
    (meta.sheets || []).map(
      (s: { properties?: { title?: string } }) => s.properties?.title || ''
    )
  );
  const missingTabs = SHEET_TABS.filter((tab) => !existingTitles.has(tab));
  if (missingTabs.length > 0) {
    const addRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: missingTabs.map((title) => ({
            addSheet: { properties: { title } },
          })),
        }),
      }
    );
    await handleGoogleApiResponse(
      addRes,
      'Gagal menambahkan tab baru ke Google Spreadsheet'
    );
  }
}

export interface WorkspaceDataset {
  learners: Learner[];
  documents: LearnerDocument[];
  attendance: AttendanceRecord[];
  modules: LearningModule[];
  quizzes: Quiz[];
  attempts: QuizAttempt[];
  leaveRequests: LeaveRequest[];
  notifications: TutorNotification[];
}

type SheetRow = (string | number)[];

function hashRow(row: SheetRow): string {
  const str = JSON.stringify(row);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function buildTabPayload(
  data: WorkspaceDataset
): Record<SheetTabName, { header: SheetRow; rows: SheetRow[] }> {
  return {
    Warga_Belajar: {
      header: [
        'ID',
        'Institution ID',
        'NISN',
        'PIN',
        'Nama Lengkap',
        'Program',
        'Rombel',
        'Tutor',
        'Email Tutor',
        'Telepon Tutor',
        'Target Kompetensi',
        'Status',
        'Telepon',
        'Alamat',
        'Tanggal Bergabung',
      ],
      rows: data.learners.map((l) => [
        l.id,
        l.institutionId,
        l.nisn,
        l.pin,
        l.nama,
        l.program,
        l.rombel,
        l.tutorNama,
        l.tutorEmail,
        l.tutorTelepon || '',
        l.targetKompetensi,
        l.status,
        l.telepon,
        l.alamat,
        l.tanggalBergabung,
      ]),
    },
    Dokumen_Drive: {
      header: [
        'ID',
        'Institution ID',
        'ID Warga Belajar',
        'Nama Warga Belajar',
        'Module ID',
        'Kategori',
        'Nama File',
        'Mime Type',
        'Ukuran',
        'Tanggal Unggah',
        'Drive File ID',
        'Drive Web Link',
        'Status',
        'Catatan',
      ],
      rows: data.documents.map((d) => [
        d.id,
        d.institutionId,
        d.learnerId,
        d.learnerNama,
        d.moduleId || '',
        d.kategori,
        d.namaFile,
        d.mimeType,
        d.ukuranLabel,
        d.tanggalUnggah,
        d.driveFileId || '',
        d.driveWebViewLink || '',
        d.statusSinkron,
        d.catatan || '',
      ]),
    },
    Absensi_Harian: {
      header: [
        'ID',
        'Institution ID',
        'Tanggal',
        'ID Warga Belajar',
        'Status',
        'Mode Pembelajaran',
        'Waktu Catat',
        'Sumber',
        'Catatan',
      ],
      rows: data.attendance.map((a) => [
        a.id,
        a.institutionId,
        a.tanggal,
        a.learnerId,
        a.status,
        a.modePembelajaran,
        a.waktuCatat,
        a.sumber || 'Manual',
        a.catatan || '',
      ]),
    },
    Modul_Pembelajaran: {
      header: [
        'ID',
        'Institution ID',
        'Kode Modul',
        'Judul Modul',
        'Program',
        'Mata Pelajaran',
        'Bobot SKK',
        'Target Nilai',
        'Deskripsi',
        'Nama Materi',
        'URL Materi Drive',
      ],
      rows: data.modules.map((m) => [
        m.id,
        m.institutionId,
        m.kode,
        m.judul,
        m.program,
        m.mataPelajaran,
        m.bobotSkk,
        m.targetNilai,
        m.deskripsi,
        m.materiNama || '',
        m.materiDriveUrl || '',
      ]),
    },
    Bank_Soal: {
      header: [
        'ID',
        'Institution ID',
        'Module ID',
        'Judul Evaluasi',
        'Mata Pelajaran',
        'Program',
        'Mode Pembelajaran',
        'Target Nilai (KKM)',
        'Durasi (Menit)',
        'Tutor Pembuat',
        'Tanggal Dibuat',
        'Remedial',
        'Assigned IDs',
        'Parent Quiz ID',
        'JSON Soal',
      ],
      rows: data.quizzes.map((q) => [
        q.id,
        q.institutionId,
        q.moduleId || '',
        q.judul,
        q.mataPelajaran,
        q.program,
        q.modePembelajaran,
        q.targetNilai,
        q.durasiMenit,
        q.tutorPembuat,
        q.tanggalDibuat,
        q.isRemedial ? 'YA' : 'TIDAK',
        JSON.stringify(q.assignedLearnerIds || []),
        q.parentQuizId || '',
        JSON.stringify(q.soal),
      ]),
    },
    Hasil_Evaluasi: {
      header: [
        'ID',
        'Institution ID',
        'Quiz ID',
        'Judul Evaluasi',
        'Mata Pelajaran',
        'Module ID',
        'Mode Pembelajaran',
        'ID Warga Belajar',
        'Nama Warga Belajar',
        'Tanggal Pengerjaan',
        'Skor',
        'Target Nilai',
        'Tuntas',
        'Benar',
        'Total Soal',
        'Total Durasi (Detik)',
        'JSON Detail',
      ],
      rows: data.attempts.map((at) => [
        at.id,
        at.institutionId,
        at.quizId,
        at.quizJudul,
        at.mataPelajaran,
        at.moduleId || '',
        at.modePembelajaran,
        at.learnerId,
        at.learnerNama,
        at.tanggalPengerjaan,
        at.skor,
        at.targetNilai,
        at.tuntas ? 'YA' : 'BELUM',
        at.totalBenar,
        at.totalSoal,
        at.totalDurasiDetik,
        JSON.stringify(at.detailSoal),
      ]),
    },
    Pengajuan_Izin: {
      header: [
        'ID',
        'Institution ID',
        'ID Warga Belajar',
        'Nama Warga Belajar',
        'Tanggal',
        'Jenis',
        'Alasan',
        'Waktu Ajukan',
        'Status',
      ],
      rows: data.leaveRequests.map((lr) => [
        lr.id,
        lr.institutionId,
        lr.learnerId,
        lr.learnerNama,
        lr.tanggal,
        lr.jenis,
        lr.alasan,
        lr.waktuAjukan,
        lr.status,
      ]),
    },
    Notifikasi_Tutor: {
      header: [
        'ID',
        'Institution ID',
        'ID Warga Belajar',
        'Nama Warga Belajar',
        'Program',
        'Tutor',
        'Email Tutor',
        'Telepon Tutor',
        'Kompetensi',
        'Skor Capaian',
        'Target',
        'Risiko EWS',
        'Pemicu',
        'Waktu Terdeteksi',
        'Status Kirim',
        'Waktu Terkirim',
        'Remedial Quiz ID',
      ],
      rows: data.notifications.map((n) => [
        n.id,
        n.institutionId,
        n.learnerId,
        n.learnerNama,
        n.program,
        n.tutorNama,
        n.tutorEmail,
        n.tutorTelepon || '',
        n.kompetensi,
        n.skorCapaian,
        n.targetNilai,
        n.riskLevel,
        n.pemicu,
        n.waktuTerdeteksi,
        n.statusKirim,
        n.waktuTerkirim || '',
        n.remedialQuizId || '',
      ]),
    },
  };
}

export interface IncrementalSyncResult {
  syncedAt: string;
  updatedRows: number;
  appendedRows: number;
  skippedRows: number;
  nextHashes: Record<string, Record<string, string>>;
}

export function previewIncrementalDelta(
  data: WorkspaceDataset,
  previousHashes: Record<string, Record<string, string>>
): { changedCount: number; newCount: number; unchangedCount: number } {
  const payload = buildTabPayload(data);
  let changedCount = 0;
  let newCount = 0;
  let unchangedCount = 0;

  for (const tab of SHEET_TABS) {
    const prevTab = previousHashes[tab] || {};
    for (const row of payload[tab].rows) {
      const id = String(row[0]);
      const h = hashRow(row);
      if (!prevTab[id]) {
        newCount++;
      } else if (prevTab[id] !== h) {
        changedCount++;
      } else {
        unchangedCount++;
      }
    }
  }
  return { changedCount, newCount, unchangedCount };
}

/**
 * Incremental Sync (Delta Update):
 * Reads only column A IDs from each sheet tab, then sends batchUpdate ONLY for modified rows
 * and appends ONLY new rows. Unchanged rows require zero cell writes, avoiding script timeouts.
 */
export async function incrementalSyncToSheets(
  accessToken: string,
  spreadsheetId: string,
  data: WorkspaceDataset,
  previousHashes: Record<string, Record<string, string>>
): Promise<IncrementalSyncResult> {
  await ensureTabsExist(accessToken, spreadsheetId);

  const payload = buildTabPayload(data);

  // Read existing column A (IDs + header cell A1) across all tabs in one batchGet call
  const idRanges = SHEET_TABS.map((tab) => `${tab}!A1:A2000`);
  const queryParams = idRanges
    .map((r) => `ranges=${encodeURIComponent(r)}`)
    .join('&');
  const existingRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchGet?${queryParams}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const existingJson = await handleGoogleApiResponse(
    existingRes,
    'Gagal memeriksa indeks ID pada Google Sheets'
  );

  const existingRowIndexByTab: Record<string, Map<string, number>> = {};
  const existingRowCountByTab: Record<string, number> = {};
  const hasHeaderByTab: Record<string, boolean> = {};

  const valueRanges: Array<{ range: string; values?: string[][] }> =
    existingJson.valueRanges || [];

  SHEET_TABS.forEach((tab, idx) => {
    const vr = valueRanges[idx];
    const colA = vr?.values || [];
    const idMap = new Map<string, number>();
    hasHeaderByTab[tab] = Boolean(colA[0] && colA[0][0] === 'ID');
    colA.forEach((cellArr, rowIdx) => {
      if (rowIdx === 0) return; // skip header
      const idVal = cellArr[0];
      if (idVal) idMap.set(idVal, rowIdx + 1); // 1-indexed sheet row
    });
    existingRowIndexByTab[tab] = idMap;
    existingRowCountByTab[tab] = colA.length;
  });

  const batchUpdates: Array<{ range: string; values: SheetRow[] }> = [];
  const nextHashes: Record<string, Record<string, string>> = {};
  let updatedRows = 0;
  let appendedRows = 0;
  let skippedRows = 0;

  for (const tab of SHEET_TABS) {
    const { header, rows } = payload[tab];
    const idMap = existingRowIndexByTab[tab];
    const prevTabHashes = previousHashes[tab] || {};
    const tabNextHashes: Record<string, string> = {};

    if (!hasHeaderByTab[tab]) {
      batchUpdates.push({
        range: `${tab}!A1`,
        values: [header],
      });
    }

    const rowsToAppend: SheetRow[] = [];

    for (const row of rows) {
      const id = String(row[0]);
      const h = hashRow(row);
      tabNextHashes[id] = h;

      const sheetRowNumber = idMap.get(id);
      if (sheetRowNumber) {
        if (prevTabHashes[id] === h) {
          skippedRows++;
        } else {
          batchUpdates.push({
            range: `${tab}!A${sheetRowNumber}`,
            values: [row],
          });
          updatedRows++;
        }
      } else {
        rowsToAppend.push(row);
        appendedRows++;
      }
    }

    if (rowsToAppend.length > 0) {
      const startRow = Math.max(2, existingRowCountByTab[tab] + 1);
      batchUpdates.push({
        range: `${tab}!A${startRow}`,
        values: rowsToAppend,
      });
    }

    nextHashes[tab] = tabNextHashes;
  }

  if (batchUpdates.length > 0) {
    const updateRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
        spreadsheetId
      )}/values:batchUpdate`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: batchUpdates,
        }),
      }
    );
    await handleGoogleApiResponse(
      updateRes,
      'Gagal mengirim pembaruan delta ke Google Spreadsheet'
    );
  }

  return {
    syncedAt: new Date().toISOString(),
    updatedRows,
    appendedRows,
    skippedRows,
    nextHashes,
  };
}

export async function loadFromSheets(
  accessToken: string,
  spreadsheetId: string,
  fallbackInstitutionId: string
): Promise<Partial<WorkspaceDataset>> {
  const metaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}?fields=sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const meta = await handleGoogleApiResponse(
    metaRes,
    'Gagal membaca struktur Google Spreadsheet'
  );
  const titles = new Set<string>(
    (meta.sheets || []).map(
      (s: { properties?: { title?: string } }) => s.properties?.title || ''
    )
  );

  const rangesToFetch = SHEET_TABS.filter((t) => titles.has(t)).map(
    (t) => `${t}!A2:Z2000`
  );
  if (rangesToFetch.length === 0) return {};

  const queryParams = rangesToFetch
    .map((r) => `ranges=${encodeURIComponent(r)}`)
    .join('&');
  const batchRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchGet?${queryParams}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const batchData = await handleGoogleApiResponse(
    batchRes,
    'Gagal memuat data dari Google Spreadsheet'
  );

  const result: Partial<WorkspaceDataset> = {};
  const valueRanges: Array<{ range: string; values?: string[][] }> =
    batchData.valueRanges || [];

  for (const vr of valueRanges) {
    const rows = vr.values || [];
    if (vr.range.startsWith('Warga_Belajar') && rows.length > 0) {
      result.learners = rows
        .filter((r) => r[0] && r[4])
        .map((r) => ({
          id: r[0],
          institutionId: r[1] || fallbackInstitutionId,
          nisn: r[2] || '',
          pin: r[3] || '1234',
          nama: r[4],
          program: (r[5] as Learner['program']) || 'Paket C',
          rombel: r[6] || 'Rombel A',
          tutorNama: r[7] || '',
          tutorEmail: r[8] || '',
          tutorTelepon: r[9] || '',
          targetKompetensi: Number(r[10]) || 75,
          status: (r[11] as Learner['status']) || 'Aktif',
          telepon: r[12] || '',
          alamat: r[13] || '',
          tanggalBergabung: r[14] || '2026-07-15',
        }));
    } else if (vr.range.startsWith('Dokumen_Drive') && rows.length > 0) {
      result.documents = rows
        .filter((r) => r[0] && r[6])
        .map((r) => ({
          id: r[0],
          institutionId: r[1] || fallbackInstitutionId,
          learnerId: r[2] || '',
          learnerNama: r[3] || '',
          moduleId: r[4] || undefined,
          kategori: (r[5] as LearnerDocument['kategori']) || 'KTP / Identitas',
          namaFile: r[6],
          mimeType: r[7] || 'application/pdf',
          ukuranLabel: r[8] || '-',
          tanggalUnggah: r[9] || '',
          driveFileId: r[10] || undefined,
          driveWebViewLink: r[11] || undefined,
          statusSinkron: r[10] ? 'Tersimpan di Drive' : 'Siap Diunggah ke Drive',
          catatan: r[13] || '',
        }));
    } else if (vr.range.startsWith('Absensi_Harian') && rows.length > 0) {
      result.attendance = rows
        .filter((r) => r[0] && r[2] && r[3])
        .map((r) => ({
          id: r[0],
          institutionId: r[1] || fallbackInstitutionId,
          tanggal: r[2],
          learnerId: r[3],
          status: (r[4] as AttendanceRecord['status']) || 'Hadir',
          modePembelajaran:
            (r[5] as AttendanceRecord['modePembelajaran']) || 'Tatap Muka',
          waktuCatat: r[6] || '08:00',
          sumber: (r[7] as AttendanceRecord['sumber']) || 'Manual',
          catatan: r[8] || '',
        }));
    } else if (vr.range.startsWith('Modul_Pembelajaran') && rows.length > 0) {
      result.modules = rows
        .filter((r) => r[0] && r[3])
        .map((r) => ({
          id: r[0],
          institutionId: r[1] || fallbackInstitutionId,
          kode: r[2] || '',
          judul: r[3],
          program: (r[4] as LearningModule['program']) || 'Paket C',
          mataPelajaran: r[5] || '',
          bobotSkk: Number(r[6]) || 2,
          targetNilai: Number(r[7]) || 75,
          deskripsi: r[8] || '',
          materiNama: r[9] || undefined,
          materiDriveUrl: r[10] || undefined,
        }));
    } else if (vr.range.startsWith('Bank_Soal') && rows.length > 0) {
      result.quizzes = rows
        .filter((r) => r[0] && r[3])
        .map((r) => {
          let soal = [];
          let assignedIds: string[] = [];
          try {
            soal = JSON.parse(r[14] || '[]');
          } catch {
            soal = [];
          }
          try {
            assignedIds = JSON.parse(r[12] || '[]');
          } catch {
            assignedIds = [];
          }
          return {
            id: r[0],
            institutionId: r[1] || fallbackInstitutionId,
            moduleId: r[2] || undefined,
            judul: r[3],
            mataPelajaran: r[4] || '',
            program: (r[5] as Quiz['program']) || 'Semua Program',
            modePembelajaran:
              (r[6] as Quiz['modePembelajaran']) || 'Tatap Muka',
            targetNilai: Number(r[7]) || 75,
            durasiMenit: Number(r[8]) || 15,
            tutorPembuat: r[9] || '',
            tanggalDibuat: r[10] || '',
            isRemedial: r[11] === 'YA',
            assignedLearnerIds: assignedIds.length ? assignedIds : undefined,
            parentQuizId: r[13] || undefined,
            soal,
          };
        });
    } else if (vr.range.startsWith('Hasil_Evaluasi') && rows.length > 0) {
      result.attempts = rows
        .filter((r) => r[0] && r[2])
        .map((r) => {
          let detailSoal = [];
          try {
            detailSoal = JSON.parse(r[16] || '[]');
          } catch {
            detailSoal = [];
          }
          return {
            id: r[0],
            institutionId: r[1] || fallbackInstitutionId,
            quizId: r[2],
            quizJudul: r[3] || '',
            mataPelajaran: r[4] || '',
            moduleId: r[5] || undefined,
            modePembelajaran:
              (r[6] as QuizAttempt['modePembelajaran']) || 'Tatap Muka',
            learnerId: r[7] || '',
            learnerNama: r[8] || '',
            tanggalPengerjaan: r[9] || '',
            skor: Number(r[10]) || 0,
            targetNilai: Number(r[11]) || 75,
            tuntas: r[12] === 'YA',
            totalBenar: Number(r[13]) || 0,
            totalSoal: Number(r[14]) || 0,
            totalDurasiDetik: Number(r[15]) || 0,
            detailSoal,
          };
        });
    } else if (vr.range.startsWith('Pengajuan_Izin') && rows.length > 0) {
      result.leaveRequests = rows
        .filter((r) => r[0] && r[2])
        .map((r) => ({
          id: r[0],
          institutionId: r[1] || fallbackInstitutionId,
          learnerId: r[2],
          learnerNama: r[3] || '',
          tanggal: r[4] || '',
          jenis: (r[5] as LeaveRequest['jenis']) || 'Izin',
          alasan: r[6] || '',
          waktuAjukan: r[7] || '',
          status: (r[8] as LeaveRequest['status']) || 'Menunggu',
        }));
    } else if (vr.range.startsWith('Notifikasi_Tutor') && rows.length > 0) {
      result.notifications = rows
        .filter((r) => r[0] && r[2])
        .map((r) => ({
          id: r[0],
          institutionId: r[1] || fallbackInstitutionId,
          learnerId: r[2],
          learnerNama: r[3] || '',
          program: (r[4] as TutorNotification['program']) || 'Paket C',
          tutorNama: r[5] || '',
          tutorEmail: r[6] || '',
          tutorTelepon: r[7] || '',
          kompetensi: r[8] || '',
          skorCapaian: Number(r[9]) || 0,
          targetNilai: Number(r[10]) || 75,
          riskLevel:
            (r[11] as TutorNotification['riskLevel']) || 'Sedang',
          pemicu: r[12] || '',
          waktuTerdeteksi: r[13] || '',
          statusKirim:
            (r[14] as TutorNotification['statusKirim']) || 'Menunggu Tindakan',
          waktuTerkirim: r[15] || undefined,
          remedialQuizId: r[16] || undefined,
        }));
    }
  }

  return result;
}

export async function uploadFileToDrive(
  accessToken: string,
  folderId: string,
  file: File,
  customName?: string
): Promise<{
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  size: string;
}> {
  const metadata = {
    name: customName || file.name,
    parents: folderId ? [folderId] : undefined,
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', file);

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );

  const uploaded = await handleGoogleApiResponse(
    res,
    'Gagal mengunggah dokumen ke Google Drive'
  );
  return {
    id: uploaded.id,
    name: uploaded.name,
    mimeType: uploaded.mimeType || file.type || 'application/octet-stream',
    webViewLink:
      uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`,
    size: uploaded.size || String(file.size),
  };
}

export async function uploadTextReportToDrive(
  accessToken: string,
  folderId: string,
  fileName: string,
  content: string,
  mimeType = 'text/csv'
): Promise<{ id: string; webViewLink: string }> {
  const metadata = {
    name: fileName,
    parents: folderId ? [folderId] : undefined,
  };
  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', new Blob([content], { type: mimeType }));

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );
  const data = await handleGoogleApiResponse(
    res,
    'Gagal menyimpan laporan ke Google Drive'
  );
  return {
    id: data.id,
    webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`,
  };
}

export async function deleteDriveFile(accessToken: string, fileId: string) {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok && res.status !== 404) {
    await handleGoogleApiResponse(res, 'Gagal menghapus file di Google Drive');
  }
}

function encodeBase64UrlUtf8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sendTutorAlertEmail(
  accessToken: string,
  toEmail: string,
  subject: string,
  bodyText: string
) {
  const encodedSubject = `=?UTF-8?B?${btoa(
    String.fromCharCode(...new TextEncoder().encode(subject))
  )}?=`;

  const rawMessage = [
    `To: ${toEmail}`,
    `Subject: ${encodedSubject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    bodyText,
  ].join('\r\n');

  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        raw: encodeBase64UrlUtf8(rawMessage),
      }),
    }
  );

  return handleGoogleApiResponse(
    res,
    'Gagal mengirim email notifikasi ke tutor melalui Gmail'
  );
}
