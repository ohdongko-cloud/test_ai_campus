"use client";

// 어드민 — 영상별 첨부파일 관리 패널 (스테이지 편집 패널과 유사한 인라인 형태).

import { useEffect, useState, useRef, useCallback } from 'react';
import { adminFetch, AdminAuthError } from '../lib/admin-client';
import {
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_ATTACHMENTS_PER_VIDEO,
  formatBytes,
  iconForFilename,
  isAllowedFile,
} from '../lib/attachments';

interface AttachmentRow {
  id: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  downloadCount: number;
  createdAt: string;
}

interface Props {
  videoId: string;
  /** 부모(AdminVideos)에 카운트 변경 알림 (row의 '📎 첨부 (N)' 갱신용) */
  onCountChange?: (count: number) => void;
}

export default function AdminVideoAttachments({ videoId, onCountChange }: Props) {
  const [items, setItems] = useState<AttachmentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0); // 0~100
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // onCountChange 는 부모에서 인라인 함수로 전달돼 매 렌더마다 참조가 바뀜.
  // load 의존성에 포함하면 무한 fetch 루프가 발생 → ref 로 우회.
  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => { onCountChangeRef.current = onCountChange; }, [onCountChange]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    adminFetch(`/api/admin/videos/${encodeURIComponent(videoId)}/attachments`)
      .then(async r => {
        if (!r.ok) throw new Error(await r.text());
        return r.json() as Promise<AttachmentRow[]>;
      })
      .then(d => {
        setItems(d);
        onCountChangeRef.current?.(d.length);
      })
      .catch(e => {
        if (e instanceof AdminAuthError) setError('관리자 세션이 만료되었습니다.');
        else setError('첨부파일 목록을 불러오지 못했습니다.');
      })
      .finally(() => setLoading(false));
  }, [videoId]);

  useEffect(() => { load(); }, [load]);

  const handleFiles = async (files: FileList | File[]) => {
    setError(null);
    const arr = Array.from(files);
    if (arr.length === 0) return;
    if (items.length + arr.length > MAX_ATTACHMENTS_PER_VIDEO) {
      setError(`영상당 최대 ${MAX_ATTACHMENTS_PER_VIDEO}개까지 등록 가능합니다.`);
      return;
    }
    // 사전 검증 (서버에서도 다시 검증함)
    for (const f of arr) {
      if (f.size > MAX_ATTACHMENT_SIZE_BYTES) {
        setError(`${f.name}: 파일 크기가 50MB 한도를 초과합니다.`);
        return;
      }
      if (!isAllowedFile(f.name, f.type)) {
        setError(`${f.name}: 지원하지 않는 파일 형식입니다 (${f.type || '확장자: ' + (f.name.split('.').pop() || 'unknown')}).`);
        return;
      }
    }

    setUploading(true);
    setProgress(0);
    let uploaded = 0;
    for (const f of arr) {
      try {
        const fd = new FormData();
        fd.append('file', f);
        const res = await adminFetch(`/api/admin/videos/${encodeURIComponent(videoId)}/attachments`, {
          method: 'POST',
          body: fd,
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d?.error || `업로드 실패: ${f.name}`);
        }
        uploaded += 1;
        setProgress(Math.round((uploaded / arr.length) * 100));
      } catch (e) {
        setError(e instanceof Error ? e.message : '업로드에 실패했습니다.');
        break;
      }
    }
    setUploading(false);
    setProgress(0);
    load();
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDelete = async (att: AttachmentRow) => {
    if (!window.confirm(`"${att.filename}" 을(를) 삭제하시겠습니까?`)) return;
    try {
      const res = await adminFetch(
        `/api/admin/videos/${encodeURIComponent(videoId)}/attachments/${encodeURIComponent(att.id)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error(await res.text());
      load();
    } catch {
      setError('삭제에 실패했습니다.');
    }
  };

  return (
    <div className="p-4 bg-blue-50 border-t border-blue-100 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-blue-700">📎 첨부파일 관리</span>
        <span className="text-xs text-gray-500">
          {items.length} / {MAX_ATTACHMENTS_PER_VIDEO}개
        </span>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-2 text-xs">
          {error}
        </div>
      )}

      {/* 목록 */}
      <div className="space-y-1.5">
        {loading && items.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-3">불러오는 중...</p>
        )}
        {!loading && items.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-3">등록된 첨부파일이 없습니다.</p>
        )}
        {items.map(att => (
          <div key={att.id} className="flex items-center gap-2 bg-white border border-gray-200 rounded px-3 py-2 text-xs">
            <span style={{ fontSize: 16 }}>{iconForFilename(att.filename)}</span>
            <div className="flex-1 min-w-0">
              <div className="text-gray-800 font-medium truncate">{att.filename}</div>
              <div className="text-gray-400 text-[10px]">
                {formatBytes(att.sizeBytes)} · 다운로드 {att.downloadCount}회
              </div>
            </div>
            <a
              href={`/api/videos/${encodeURIComponent(videoId)}/attachments/${encodeURIComponent(att.id)}/download`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 px-2 py-1 border border-blue-200 rounded hover:bg-blue-50"
            >
              다운
            </a>
            <button
              onClick={() => handleDelete(att)}
              className="text-red-500 hover:text-red-700 px-2 py-1 border border-red-200 rounded hover:bg-red-50"
            >
              삭제
            </button>
          </div>
        ))}
      </div>

      {/* 업로드 영역 */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          dragOver ? 'border-blue-500 bg-blue-100' : 'border-gray-300 bg-white'
        }`}
      >
        {uploading ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-700">업로드 중... {progress}%</p>
            <div className="w-full h-1.5 bg-gray-200 rounded overflow-hidden">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-700 mb-2">📎 파일을 여기로 드래그하거나</p>
            <input
              ref={inputRef}
              type="file"
              multiple
              onChange={e => e.target.files && handleFiles(e.target.files)}
              className="hidden"
              id={`att-input-${videoId}`}
            />
            <label
              htmlFor={`att-input-${videoId}`}
              className="inline-block px-3 py-1.5 bg-white border border-gray-300 rounded text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              파일 선택
            </label>
            <p className="text-[10px] text-gray-400 mt-2">
              PDF / PPT / DOCX / XLSX / ZIP / TXT / MD / 이미지 · 최대 50MB · 영상당 {MAX_ATTACHMENTS_PER_VIDEO}개
            </p>
          </>
        )}
      </div>
    </div>
  );
}
