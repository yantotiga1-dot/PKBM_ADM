import React, { useMemo, useRef, useState } from 'react';
import {
  CloudUpload,
  ExternalLink,
  FileText,
  FolderOpen,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  DocumentCategory,
  GoogleWorkspaceConfig,
  Learner,
  LearnerDocument,
} from '../types';

interface DocumentVaultProps {
  learners: Learner[];
  documents: LearnerDocument[];
  isWorkspaceConnected: boolean;
  workspaceConfig: GoogleWorkspaceConfig | null;
  onUploadDocument: (params: {
    learner: Learner;
    kategori: DocumentCategory;
    catatan: string;
    file: File;
  }) => Promise<void>;
  onDeleteDocument: (doc: LearnerDocument) => void;
  onConnectWorkspace: () => void;
}

const CATEGORIES: DocumentCategory[] = [
  'KTP / Identitas',
  'Ijazah Sebelumnya',
  'Kartu Keluarga',
  'Portofolio Tugas',
  'Materi Belajar',
  'Surat Keterangan',
];

export const DocumentVault: React.FC<DocumentVaultProps> = ({
  learners,
  documents,
  isWorkspaceConnected,
  workspaceConfig,
  onUploadDocument,
  onDeleteDocument,
  onConnectWorkspace,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('Semua');
  const [selectedLearnerId, setSelectedLearnerId] = useState<string>(
    learners[0]?.id || ''
  );
  const [kategori, setKategori] = useState<DocumentCategory>('KTP / Identitas');
  const [catatan, setCatatan] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredDocs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return documents.filter((d) => {
      const matchCat =
        categoryFilter === 'Semua' || d.kategori === categoryFilter;
      const matchQ =
        !q ||
        d.namaFile.toLowerCase().includes(q) ||
        d.learnerNama.toLowerCase().includes(q) ||
        d.kategori.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [documents, searchQuery, categoryFilter]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) return;
    const learner = learners.find((l) => l.id === selectedLearnerId);
    if (!learner) return;

    setUploadError(null);
    setIsUploading(true);
    try {
      await onUploadDocument({
        learner,
        kategori,
        catatan,
        file: selectedFile,
      });
      setSelectedFile(null);
      setCatatan('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Gagal mengunggah dokumen.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Arsip Berkas Warga Belajar Terintegrasi Google Drive
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Dokumen Terkait Warga Belajar
          </h1>
        </div>

        {workspaceConfig?.driveFolderUrl ? (
          <a
            href={workspaceConfig.driveFolderUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <FolderOpen className="h-4 w-4 text-blue-700" />
            <span>Buka Folder Google Drive</span>
            <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
          </a>
        ) : (
          <button
            type="button"
            onClick={onConnectWorkspace}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <CloudUpload className="h-4 w-4 text-blue-700" />
            <span>Hubungkan Google Drive</span>
          </button>
        )}
      </div>

      {/* Upload Form */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Unggah Dokumen Baru
            </h2>
            <p className="text-xs text-slate-500">
              {isWorkspaceConnected
                ? 'File akan diunggah langsung ke folder Google Drive Anda dan dicatat pada Google Sheets.'
                : 'Hubungkan akun Google Anda terlebih dahulu untuk mengunggah langsung ke Google Drive.'}
            </p>
          </div>
        </div>

        <form
          onSubmit={handleUploadSubmit}
          className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-12"
        >
          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-700">
              Warga Belajar
            </label>
            <select
              value={selectedLearnerId}
              onChange={(e) => setSelectedLearnerId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            >
              {learners.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nama} ({l.program})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-700">
              Kategori Dokumen
            </label>
            <select
              value={kategori}
              onChange={(e) => setKategori(e.target.value as DocumentCategory)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-700">
              Pilih Berkas (PDF / Gambar / Dokumen)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              required
              onChange={(e) =>
                setSelectedFile(e.target.files?.[0] || null)
              }
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-blue-700"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-semibold text-slate-700">
              Catatan Ringkas
            </label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Mis. Terverifikasi asli"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!selectedFile || isUploading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Upload className="h-4 w-4" />
                <span>{isUploading ? 'Mengunggah...' : 'Unggah'}</span>
              </button>
            </div>
          </div>
        </form>

        {uploadError && (
          <p className="mt-3 text-xs font-medium text-red-700">{uploadError}</p>
        )}
      </div>

      {/* Filters & Document Table */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nama berkas atau warga belajar..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm focus:border-blue-600 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {['Semua', ...CATEGORIES].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                categoryFilter === cat
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <th className="px-6 py-3">Nama Dokumen</th>
                <th className="px-4 py-3">Warga Belajar</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3 text-right">Ukuran</th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Status Drive</th>
                <th className="px-6 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-sm text-slate-500"
                  >
                    Belum ada dokumen yang cocok dengan pencarian Anda.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="transition-colors hover:bg-slate-50/70"
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <FileText className="h-4 w-4 shrink-0 text-blue-700" />
                        <div>
                          <div className="font-medium text-slate-900">
                            {doc.namaFile}
                          </div>
                          {doc.catatan && (
                            <div className="text-xs text-slate-500">
                              {doc.catatan}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs font-medium text-slate-800">
                      {doc.learnerNama}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-slate-600">
                      {doc.kategori}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs text-slate-600 tabular-nums">
                      {doc.ukuranLabel}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-600 tabular-nums">
                      {doc.tanggalUnggah}
                    </td>
                    <td className="px-4 py-3.5 text-xs font-medium">
                      {doc.driveFileId ? (
                        <span className="text-emerald-700">
                          Tersimpan di Drive
                        </span>
                      ) : (
                        <span className="text-amber-700">
                          Arsip Lokal (Siap Sinkron)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        {doc.driveWebViewLink && (
                          <a
                            href={doc.driveWebViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-slate-50"
                          >
                            <span>Buka</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteDocument(doc)}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Hapus ${doc.namaFile}`}
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
    </div>
  );
};
