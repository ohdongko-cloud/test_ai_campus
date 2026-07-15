import Link from 'next/link';

export default function VideoNotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: 24,
        background: '#F5F7FA',
        color: '#0F1E33',
        fontFamily: '"Noto Sans KR", "Inter", system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 40 }} aria-hidden>🎬</div>
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>영상을 찾을 수 없습니다</h1>
      <p style={{ margin: 0, fontSize: 14, color: '#6B7A91', lineHeight: 1.6 }}>
        삭제되었거나 잘못된 링크일 수 있습니다.
      </p>
      <Link
        href="/#videos"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '11px 22px',
          borderRadius: 10,
          background: '#004A99',
          color: '#fff',
          textDecoration: 'none',
          fontSize: 14,
          fontWeight: 700,
        }}
      >
        강의 목록으로
      </Link>
    </div>
  );
}
