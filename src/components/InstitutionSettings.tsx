import React, { useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  FolderOpen,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Sliders,
} from 'lucide-react';
import { Institution, SyncBaseline } from '../types';
import { GoogleSignInButton } from './GoogleSignInButton';

interface InstitutionSettingsProps {
  institutions: Institution[];
  activeInstitution: Institution;
  isWorkspaceConnected: boolean;
  isLoggingIn: boolean;
  isSyncing: boolean;
  deltaPreview: {
    changedCount: number;
    newCount: number;
    unchangedCount: number;
  };
  syncBaseline: SyncBaseline | null;
  onSelectInstitution: (id: string) => void;
  onAddInstitution: (inst: Institution) => void;
  onUpdateInstitution: (inst: Institution) => void;
  onGoogleSignIn: () => void;
  onProvisionWorkspaceForInst: (
    customSpreadsheetId?: string,
    customFolderId?: string
  ) => Promise<void>;
  onRunIncrementalSync: () => void;
  onLoadFromSheets: () => void;
}

export const InstitutionSettings: React.FC<InstitutionSettingsProps> = ({
  institutions,
  activeInstitution,
  isWorkspaceConnected,
  isLoggingIn,
  isSyncing,
  deltaPreview,
  syncBaseline,
  onSelectInstitution,
  onAddInstitution,
  onUpdateInstitution,
  onGoogleSignIn,
  onProvisionWorkspaceForInst,
  onRunIncrementalSync,
  onLoadFromSheets,
}) => {
  const [sheetIdInput, setSheetIdInput] = useState(
    activeInstitution.workspaceConfig?.spreadsheetId || ''
  );
  const [folderIdInput, setFolderIdInput] = useState(
    activeInstitution.workspaceConfig?.driveFolderId || ''
  );
  const [skkTM, setSkkTM] = useState(activeInstitution.skkWeights.tatapMuka);
  const [skkTut, setSkkTut] = useState(activeInstitution.skkWeights.tutorial);
  const [skkMan, setSkkMan] = useState(activeInstitution.skkWeights.mandiri);
  const [channels, setChannels] = useState(activeInstitution.channelSettings);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // Add new institution form
  const [showNewInstForm, setShowNewInstForm] = useState(false);
  const [newNama, setNewNama] = useState('');
  const [newKode, setNewKode] = useState('');
  const [newKota, setNewKota] = useState('');
  const [newKepala, setNewKepala] = useState('');
  const [newTelepon, setNewTelepon] = useState('');

  useEffect(() => {
    setSheetIdInput(activeInstitution.workspaceConfig?.spreadsheetId || '');
    setFolderIdInput(activeInstitution.workspaceConfig?.driveFolderId || '');
    setSkkTM(activeInstitution.skkWeights.tatapMuka);
    setSkkTut(activeInstitution.skkWeights.tutorial);
    setSkkMan(activeInstitution.skkWeights.mandiri);
    setChannels(activeInstitution.channelSettings);
    setSavedMsg(null);
  }, [activeInstitution]);

  const totalSkk = skkTM + skkTut + skkMan;

  const handleSaveSkkAndChannels = (e: React.FormEvent) => {
    e.preventDefault();
    if (totalSkk !== 100) return;
    onUpdateInstitution({
      ...activeInstitution,
      skkWeights: {
        tatapMuka: skkTM,
        tutorial: skkTut,
        mandiri: skkMan,
      },
      channelSettings: channels,
    });
    setSavedMsg(
      'Pengaturan bobot SKK dan kanal notifikasi lembaga berhasil disimpan.'
    );
  };

  const handleCreateInstitution = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNama.trim()) return;
    const newInst: Institution = {
      id: `LMB-${Date.now().toString().slice(-4)}`,
      kode: newKode.trim() || `PKBM-${Date.now().toString().slice(-3)}`,
      nama: newNama.trim(),
      kota: newKota.trim() || 'Indonesia',
      kepalaLembaga: newKepala.trim() || 'Pengelola Lembaga',
      telepon: newTelepon.trim() || '-',
      skkWeights: { tatapMuka: 40, tutorial: 30, mandiri: 30 },
      workspaceConfig: null,
      channelSettings: {
        enableGmail: true,
        enableWhatsApp: true,
        enableInAppBanner: true,
        autoPublishRemedial: true,
        senderAlias: newNama.trim(),
      },
    };
    onAddInstitution(newInst);
    onSelectInstitution(newInst.id);
    setShowNewInstForm(false);
    setNewNama('');
    setNewKode('');
    setNewKota('');
    setNewKepala('');
    setNewTelepon('');
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Konfigurasi Multi-Lembaga, Google Sheets, Google Drive, Gmail & Kurikulum SKK
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Pengaturan Lembaga & Google Workspace
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setShowNewInstForm((v) => !v)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          <span>Tambah Lembaga Baru</span>
        </button>
      </div>

      {/* Add Institution Form */}
      {showNewInstForm && (
        <form
          onSubmit={handleCreateInstitution}
          className="rounded-xl border border-blue-200 bg-blue-50/40 p-6 space-y-4"
        >
          <h2 className="text-base font-semibold text-slate-900">
            Daftarkan Lembaga Pendidikan Baru (PKBM / LKP)
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Nama Lembaga
              </label>
              <input
                type="text"
                required
                value={newNama}
                onChange={(e) => setNewNama(e.target.value)}
                placeholder="Mis. PKBM Tunas Harapan"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Kode Lembaga / NPSN
              </label>
              <input
                type="text"
                value={newKode}
                onChange={(e) => setNewKode(e.target.value)}
                placeholder="Mis. P9988123"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Kota / Kabupaten
              </label>
              <input
                type="text"
                value={newKota}
                onChange={(e) => setNewKota(e.target.value)}
                placeholder="Mis. Kota Kediri"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Kepala Lembaga / Pengelola
              </label>
              <input
                type="text"
                value={newKepala}
                onChange={(e) => setNewKepala(e.target.value)}
                placeholder="Nama lengkap & gelar"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Telepon Lembaga
              </label>
              <input
                type="text"
                value={newTelepon}
                onChange={(e) => setNewTelepon(e.target.value)}
                placeholder="0354-..."
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewInstForm(false)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700"
            >
              Batal
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
            >
              Simpan & Aktifkan Lembaga
            </button>
          </div>
        </form>
      )}

      {/* Institution Switcher */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Building2 className="h-4 w-4 text-blue-700" />
          <span>Pilih Lembaga yang Sedang Dikelola</span>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          {institutions.map((inst) => {
            const isSelected = inst.id === activeInstitution.id;
            return (
              <button
                key={inst.id}
                type="button"
                onClick={() => onSelectInstitution(inst.id)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  isSelected
                    ? 'border-blue-700 bg-blue-50/50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold text-slate-500">
                    {inst.kode}
                  </span>
                  {isSelected && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Aktif
                    </span>
                  )}
                </div>
                <p className="mt-1 font-semibold text-slate-900">{inst.nama}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {inst.kota} · {inst.kepalaLembaga}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Google Sheets, Drive & Incremental Sync Panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Pengaturan Google Sheets & Google Drive ({activeInstitution.nama})
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Setiap lembaga memiliki Spreadsheet dan Folder Drive terpisah agar data warga belajar tetap terisolasi dan aman.
              </p>
            </div>
            {!isWorkspaceConnected && (
              <GoogleSignInButton
                onClick={onGoogleSignIn}
                disabled={isLoggingIn}
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                <span>Google Spreadsheet ID Lembaga</span>
              </label>
              <input
                type="text"
                value={sheetIdInput}
                onChange={(e) => setSheetIdInput(e.target.value)}
                placeholder="Kosongkan untuk buat otomatis"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs focus:border-blue-600 focus:outline-none"
              />
              {activeInstitution.workspaceConfig?.spreadsheetUrl && (
                <a
                  href={activeInstitution.workspaceConfig.spreadsheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                >
                  <span>Buka Spreadsheet Lembaga</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <FolderOpen className="h-3.5 w-3.5 text-blue-700" />
                <span>Google Drive Folder ID Lembaga</span>
              </label>
              <input
                type="text"
                value={folderIdInput}
                onChange={(e) => setFolderIdInput(e.target.value)}
                placeholder="Kosongkan untuk buat otomatis"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs focus:border-blue-600 focus:outline-none"
              />
              {activeInstitution.workspaceConfig?.driveFolderUrl && (
                <a
                  href={activeInstitution.workspaceConfig.driveFolderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                >
                  <span>Buka Folder Drive Lembaga</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={!isWorkspaceConnected || isSyncing}
              onClick={() =>
                onProvisionWorkspaceForInst(
                  sheetIdInput.trim() || undefined,
                  folderIdInput.trim() || undefined
                )
              }
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              Simpan & Inisialisasi Resource Google
            </button>
            <button
              type="button"
              disabled={
                !isWorkspaceConnected ||
                isSyncing ||
                !activeInstitution.workspaceConfig?.spreadsheetId
              }
              onClick={onLoadFromSheets}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Muat Data dari Sheets</span>
            </button>
            <button
              type="button"
              disabled={!isWorkspaceConnected || isSyncing}
              onClick={onRunIncrementalSync}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Jalankan Incremental Sync (Delta)</span>
            </button>
          </div>
        </div>

        {/* Incremental Sync Delta Diagnostic Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">
            Status Incremental Sync (Delta Update)
          </h2>
          <p className="text-xs leading-relaxed text-slate-600">
            Sistem hanya mengirim baris yang baru atau berubah ke Google Sheets, menghindari penulisan ulang penuh dan mencegah batas timeout saat data membesar.
          </p>

          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500">Baris Baru</p>
              <p className="mt-1 font-mono text-xl font-bold text-blue-700 tabular-nums">
                {deltaPreview.newCount}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500">Diubah</p>
              <p className="mt-1 font-mono text-xl font-bold text-amber-700 tabular-nums">
                {deltaPreview.changedCount}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[11px] text-slate-500">Dilewati (Sama)</p>
              <p className="mt-1 font-mono text-xl font-bold text-emerald-700 tabular-nums">
                {deltaPreview.unchangedCount}
              </p>
            </div>
          </div>

          {syncBaseline?.lastDeltaSummary ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 font-mono text-[11px] text-slate-600 tabular-nums">
              <p>
                Sinkron Terakhir:{' '}
                {syncBaseline.lastDeltaSummary.timestamp
                  .slice(0, 19)
                  .replace('T', ' ')}
              </p>
              <p className="mt-0.5">
                Delta terkirim: +{syncBaseline.lastDeltaSummary.appendedRows}{' '}
                baru · {syncBaseline.lastDeltaSummary.updatedRows} diperbarui ·{' '}
                {syncBaseline.lastDeltaSummary.skippedRows} dilewati
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              Belum ada riwayat delta sync untuk lembaga ini.
            </p>
          )}
        </div>
      </div>

      {/* SKK Weighting & Multi-channel Alert Settings */}
      <form
        onSubmit={handleSaveSkkAndChannels}
        className="grid grid-cols-1 gap-6 lg:grid-cols-12"
      >
        {/* SKK Kurikulum Kesetaraan */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-blue-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Pembobotan SKK Kurikulum Kesetaraan
            </h2>
          </div>
          <p className="text-xs text-slate-500">
            Atur proporsi kontribusi Satuan Kredit Kompetensi (SKK) untuk jalur Tatap Muka, Tutorial, dan Mandiri. Total bobot harus tepat 100%.
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Tatap Muka (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={skkTM}
                onChange={(e) => setSkkTM(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Tutorial (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={skkTut}
                onChange={(e) => setSkkTut(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">
                Mandiri (%)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={skkMan}
                onChange={(e) => setSkkMan(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="flex items-center justify-between font-mono text-xs tabular-nums">
            <span>Total Bobot SKK:</span>
            <span
              className={
                totalSkk === 100
                  ? 'font-bold text-emerald-700'
                  : 'font-bold text-red-700'
              }
            >
              {totalSkk}% {totalSkk !== 100 && '(Harus 100%)'}
            </span>
          </div>
        </div>

        {/* Multi-channel Gmail + WhatsApp + In-App & Auto-Remedial */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6 space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-700" />
            <h2 className="text-base font-semibold text-slate-900">
              Kanal Notifikasi Gmail, WhatsApp & Remidial Otomatis
            </h2>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">
              Nama Pengirim / Alias Lembaga pada Email Gmail
            </label>
            <input
              type="text"
              value={channels.senderAlias}
              onChange={(e) =>
                setChannels((c) => ({ ...c, senderAlias: e.target.value }))
              }
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={channels.enableWhatsApp}
                onChange={(e) =>
                  setChannels((c) => ({ ...c, enableWhatsApp: e.target.checked }))
                }
                className="h-4 w-4 rounded text-blue-700"
              />
              <span className="font-medium text-slate-800">
                Aktifkan Peringatan WhatsApp Tutor
              </span>
            </label>

            <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={channels.enableGmail}
                onChange={(e) =>
                  setChannels((c) => ({ ...c, enableGmail: e.target.checked }))
                }
                className="h-4 w-4 rounded text-blue-700"
              />
              <span className="font-medium text-slate-800">
                Aktifkan Pengiriman Gmail
              </span>
            </label>

            <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={channels.enableInAppBanner}
                onChange={(e) =>
                  setChannels((c) => ({
                    ...c,
                    enableInAppBanner: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded text-blue-700"
              />
              <span className="font-medium text-slate-800">
                Tampilkan Peringatan di Portal Siswa
              </span>
            </label>

            <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={channels.autoPublishRemedial}
                onChange={(e) =>
                  setChannels((c) => ({
                    ...c,
                    autoPublishRemedial: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded text-blue-700"
              />
              <span className="font-medium text-slate-800">
                Terbitkan Soal Remidial Otomatis
              </span>
            </label>
          </div>

          <div className="flex items-center justify-between pt-2">
            {savedMsg ? (
              <span className="text-xs font-medium text-emerald-700">
                {savedMsg}
              </span>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={totalSkk !== 100}
              className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              Simpan Pengaturan SKK & Kanal
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
