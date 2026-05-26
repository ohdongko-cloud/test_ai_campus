import { ImageResponse } from 'next/og';

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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1647A8',
          color: '#fff',
          borderRadius: 8,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '-0.04em',
          fontFamily: 'sans-serif',
        }}
      >
        Eland
      </div>
    ),
    { ...size }
  );
}
