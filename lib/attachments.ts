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
  'application/x-zip',
  'application/octet-stream', // 일부 브라우저(OS)는 office/zip 등을 octet-stream 으로 보냄
  'text/plain',
  'text/markdown',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
]);

// 확장자 화이트리스트 — MIME 이 비어있거나 octet-stream 등 비표준일 때 fallback.
// 일부 브라우저/OS 가 .pptx 를 빈 string, application/x-mspowerpoint, application/octet-stream 등으로
// 보내는 경우가 있어 MIME 단독 체크로는 거부될 수 있음. 확장자도 함께 보면 견고.
export const ALLOWED_EXTENSIONS = new Set<string>([
  'pdf',
  'ppt', 'pptx',
  'doc', 'docx',
  'xls', 'xlsx',
  'zip',
  'txt', 'md', 'csv',
  'png', 'jpg', 'jpeg', 'gif', 'webp',
]);

/** MIME 또는 확장자 중 하나라도 화이트리스트에 있으면 허용. 둘 다 미상이면 거부. */
export function isAllowedFile(filename: string, mime: string): boolean {
  const m = (mime || '').toLowerCase();
  if (m && ALLOWED_MIME_TYPES.has(m)) return true;
  const ext = (filename.split('.').pop() || '').toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext);
}

/** @deprecated isAllowedFile(filename, mime) 사용. MIME 만 체크하면 일부 브라우저에서 false negative. */
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
