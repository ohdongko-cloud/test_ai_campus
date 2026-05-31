import { ImageResponse } from 'next/og';

// 브라우저 탭 favicon (32×32). BrandMark 와 동일 비주얼을 인라인 재현
// (ImageResponse 는 React 컴포넌트 import 가 자유롭지 않음).
export const runtime = 'edge';
export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1647A8 0%, #0B2664 100%)',
          color: '#fff',
          borderRadius: 8,
          fontSize: 16,
          fontWeight: 800,
          letterSpacing: '-0.04em',
          fontFamily: 'sans-serif',
        }}
      >
        AI
        <div
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 6,
            height: 6,
            borderRadius: 999,
            background: '#FF914D',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
