// 첨부파일 정책 + 공용 유틸.

export const MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024; // 50MB
export const MAX_ATTACHMENTS_PER_VIDEO = 10;

// MIME 화이트리스트 — 실행파일/HTML(스크립트) 차단
export const ALLOWED_MIME_TYPES = new Set<string>([
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'text/markdown',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

export function isAllowedMime(type: string): boolean {
  return ALLOWED_MIME_TYPES.has((type || '').toLowerCase());
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// 파일 확장자에 따른 이모지(시각 보조)
export function iconForFilename(name: string): string {
  const ext = (name.split('.').pop() || '').toLowerCase();
  if (['pdf'].includes(ext)) return '📄';
  if (['ppt', 'pptx'].includes(ext)) return '📊';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📈';
  if (['zip', 'rar', '7z'].includes(ext)) return '🗜️';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return '🖼️';
  if (['txt', 'md'].includes(ext)) return '📃';
  return '📎';
}
