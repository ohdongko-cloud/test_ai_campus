'use client';

import { M } from '../_styles/tokens';
import type { SharedService } from '../../../lib/types';
import { maskName } from '../../../lib/utils';

interface Props {
  service: SharedService;
}

function hostOf(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function MobileServiceCard({ service }: Props) {
  const author = service.testAccount ? maskName(service.testAccount.split('@')[0] || '') : '';

  return (
    <a
      href={service.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block',
        margin: '0 16px 12px',
        padding: 16,
        borderRadius: M.r4,
        background: M.surface,
        border: `1px solid ${M.border}`,
        boxShadow: M.shadowSm,
        textDecoration: 'none',
        color: 'inherit',
        fontFamily: M.fontKo,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: M.text,
              letterSpacing: '-0.01em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {service.serviceName}
          </div>
          <div
            style={{
              fontSize: 12,
              color: M.primary,
              fontWeight: 600,
              marginTop: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {hostOf(service.url)}
          </div>
        </div>
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            width: 32,
            height: 32,
            borderRadius: 16,
            background: M.primaryLight,
            color: M.primary,
            display: 'grid',
            placeItems: 'center',
            fontFamily: M.fontEn,
            fontSize: 14,
            fontWeight: 700,
          }}
          title="외부 링크"
        >
          ↗
        </span>
      </div>

      {service.description && (
        <p
          style={{
            margin: '10px 0 0',
            fontSize: 13,
            color: M.textBody,
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical' as const,
            overflow: 'hidden',
          }}
        >
          {service.description}
        </p>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 11, color: M.textMuted }}>
        {author && <span>등록 · {author}</span>}
        {service.testAccount && <span>· 테스트 계정 제공</span>}
      </div>
    </a>
  );
}
