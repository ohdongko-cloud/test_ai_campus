'use client';

/**
 * /auth/login 클라이언트 자식 — 마운트 시 NoA Keycloak으로 이동한다.
 *
 * - lib/noa-oidc.ts의 startLogin({ issuer, clientId })을 호출한다(자체 구현, 외부 SDK
 *   아님). PKCE verifier·state·nonce를 sessionStorage에 넣고
 *   window.location.assign으로 Keycloak authorize 엔드포인트로 이동시킨다.
 * - startLogin은 복귀 경로를 다루지 않는다 — 콜백 페이지가 실제로 쓸 복귀 경로는
 *   startLogin 호출 전에 우리 키(lib/noa-auth-return.ts의 NOA_SSO_RETURN_KEY)로
 *   이 컴포넌트가 직접 저장해 둔다(아래 참고).
 * - env 미설정(로컬 등)이면 로그인을 시도하지 않고 안내만 표시 — 기능이 죽지 않게.
 */
import { useEffect, useRef, useState } from 'react';
import { startLogin } from '../../../lib/noa-oidc';
import { sanitizeNext } from '../../../lib/sanitize-next';
import { NOA_SSO_RETURN_KEY, NOA_SSO_REMEMBER_KEY } from '../../../lib/noa-auth-return';

interface Props {
  configured: boolean;
  issuer: string;
  clientId: string;
  nextRaw: string | null;
}

const T = {
  bg: 'var(--color-bg, #F5F7FA)',
  text: '#0F1E33',
  muted: '#6B7A91',
  danger: '#D8364C',
  primary: '#004A99',
  fontKo: '"Noto Sans KR", "Inter", system-ui, sans-serif',
};

export default function AuthLoginClient({ configured, issuer, clientId, nextRaw }: Props) {
  const [error, setError] = useState('');
  // StrictMode 이중 마운트/재렌더로 인한 중복 이동(중복 PKCE 발급) 방지 가드
  const startedRef = useRef(false);
  const nextPath = sanitizeNext(nextRaw);

  useEffect(() => {
    if (!configured || startedRef.current) return;
    startedRef.current = true;

    try {
      window.sessionStorage.setItem(NOA_SSO_RETURN_KEY, nextPath);
    } catch {
      // sessionStorage 접근 불가(프라이빗 모드 등) — 콜백에서 기본값 '/'로 대체됨
    }

    // F15: 이 페이지로 넘어올 때 붙은 remember=1|0(현재 '자동 로그인' 체크 상태)을
    // 콜백까지 이어 전달한다. 값이 없거나 저장 실패 시 콜백은 안전한 false로 취급한다.
    try {
      const remember = new URLSearchParams(window.location.search).get('remember') === '1';
      window.sessionStorage.setItem(NOA_SSO_REMEMBER_KEY, remember ? '1' : '0');
    } catch {
      // sessionStorage 접근 불가 — 콜백에서 기본값 false로 대체됨
    }

    // 복귀 경로(nextPath)는 위에서 NOA_SSO_RETURN_KEY에 이미 저장했다 — startLogin은 관여하지 않는다.
    startLogin({ issuer, clientId }).catch(() => {
      setError('사내 계정 로그인 페이지로 이동하지 못했습니다. 잠시 후 다시 시도해주세요.');
    });
    // configured/issuer/clientId/nextPath는 이 페이지 수명 동안 불변 — 마운트 1회만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  if (!configured) {
    return (
      <Shell>
        <p style={{ margin: 0, fontSize: 14, color: T.muted, lineHeight: 1.6, textAlign: 'center' }}>
          사내 계정 로그인을 현재 사용할 수 없습니다.
          <br />
          잠시 후 다시 시도하거나 이메일 로그인을 이용해주세요.
        </p>
        <a href={`/login${nextRaw ? `?next=${encodeURIComponent(nextRaw)}` : ''}`} style={linkStyle}>
          로그인 화면으로 돌아가기
        </a>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <p style={{ margin: 0, fontSize: 14, color: T.danger, lineHeight: 1.6, textAlign: 'center' }}>
          {error}
        </p>
        {/* F10: next를 잃지 않도록 여기서도 복귀 경로를 이어 붙인다 */}
        <a href={`/login${nextPath !== '/' ? `?next=${encodeURIComponent(nextPath)}` : ''}`} style={linkStyle}>
          로그인 화면으로 돌아가기
        </a>
      </Shell>
    );
  }

  return (
    <Shell>
      <p style={{ margin: 0, fontSize: 14, color: T.muted }}>사내 계정으로 이동하는 중입니다...</p>
    </Shell>
  );
}

const linkStyle: React.CSSProperties = {
  marginTop: 16,
  fontSize: 13,
  color: T.primary,
  textDecoration: 'underline',
  fontFamily: T.fontKo,
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: T.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
        fontFamily: T.fontKo,
      }}
    >
      {children}
    </div>
  );
}
