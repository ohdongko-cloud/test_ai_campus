'use client';

/**
 * /auth/callback 클라이언트 자식.
 *
 * 1. lib/noa-oidc.ts의 handleCallback({ issuer, clientId })이 PKCE로 code → id_token을
 *    직접 교환한다(자체 구현, 외부 SDK 아님). **토큰은 어디에도 저장하지 않고
 *    반환만 한다**(lib/noa-oidc.ts의 명시적 불변 — sessionStorage에도 남기지 않음).
 *    호출 직후(성공·실패 무관) 쿼리스트링(인가코드 등)을 즉시 URL에서 제거한다
 *    (F6 — 히스토리/Referer로 코드가 새는 것을 막는다).
 * 2. 반환받은 idToken을 즉시 POST /api/users/sso-login 으로 넘겨 **우리 서버**의
 *    httpOnly 세션 쿠키로 바꾼다(클라이언트 메모리에도 남기지 않고 바로 소비).
 *    rememberMe는 로그인 시작 시 저장해 둔 '자동 로그인' 체크 상태
 *    (lib/noa-auth-return.ts)를 그대로 전달하며, 값이 없으면 안전한 false로
 *    취급한다(F15). 응답: 200 → 회원 정보 / 401·429·500 → { error }.
 * 3. 200이면 로그인 시작 시 저장해 둔 복귀 경로(lib/noa-auth-return.ts)를 다시
 *    sanitizeNext로 검증한 뒤 이동한다(저장된 값도 신뢰하지 않고 재검증). 복귀
 *    경로는 **성공했을 때만** sessionStorage에서 지운다 — 실패 시 남겨 두어 에러
 *    화면의 "돌아가기" 링크가 같은 경로를 이어받게 한다(F10).
 * 4. 실패하면 서버가 준 에러 문구를 그대로 보여준다(원인별로 쪼개 노출하지 않음,
 *    §6-8 에러 통일). 토큰은 화면·콘솔에 절대 출력하지 않는다.
 */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { handleCallback } from '../../../lib/noa-oidc';
import { sanitizeNext } from '../../../lib/sanitize-next';
import { NOA_SSO_RETURN_KEY, NOA_SSO_REMEMBER_KEY } from '../../../lib/noa-auth-return';
import { setUserInfo } from '../../../lib/utils';

interface Props {
  configured: boolean;
  issuer: string;
  clientId: string;
}

type Status = 'loading' | 'error';

const T = {
  bg: 'var(--color-bg, #F5F7FA)',
  muted: '#6B7A91',
  danger: '#D8364C',
  primary: '#004A99',
  fontKo: '"Noto Sans KR", "Inter", system-ui, sans-serif',
};

// 서버 응답 error가 없는 클라이언트측 실패(콜백 코드 누락, 토큰 교환 실패, 네트워크 오류 등)에
// 쓰는 통일 문구 — 원인을 화면에 세분화해서 노출하지 않는다.
const GENERIC_ERROR = '로그인 처리 중 문제가 발생했습니다. 다시 시도해주세요.';

export default function AuthCallbackClient({ configured, issuer, clientId }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState('');
  // F10: 실패 시 "돌아가기" 링크가 이어받을 복귀 경로(성공 시엔 안 쓰고 바로 이동)
  const [errorNext, setErrorNext] = useState('/');
  // StrictMode 이중 마운트로 인한 code 중복 소진(authorization code는 1회용) 방지 가드.
  // (F17/F18) 이 가드가 이미 중복 실행을 막으므로 별도 cancelled 플래그/조기 반환은 두지
  // 않는다 — StrictMode dev 이중 마운트에서 1차 effect의 cleanup이 cancelled=true를 세팅해
  // 정상 응답을 받고도 조용히 return, 화면이 '로그인 처리 중'에 영구히 멈추는 문제가 있었다.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!configured) {
      setStatus('error');
      setError('사내 계정 로그인을 현재 사용할 수 없습니다.');
      return;
    }

    (async () => {
      // 복귀 경로 · 자동 로그인 여부는 성공/실패 분기 모두에서 필요하므로 먼저 읽어 둔다.
      // 저장 자체는 여기서 지우지 않는다 — 성공했을 때만 아래에서 소비(삭제)한다(F10).
      let storedReturn: string | null = null;
      let storedRemember: string | null = null;
      try {
        storedReturn = window.sessionStorage.getItem(NOA_SSO_RETURN_KEY);
        storedRemember = window.sessionStorage.getItem(NOA_SSO_REMEMBER_KEY);
      } catch {
        // sessionStorage 접근 불가 — 기본값(복귀 '/', rememberMe false) 유지
      }
      // 저장돼 있던 값도 신뢰하지 않고 한 번 더 검증(오픈리다이렉트 방지)
      const returnPath = sanitizeNext(storedReturn);
      const rememberMe = storedRemember === '1';
      setErrorNext(returnPath);

      try {
        const session = await (async () => {
          try {
            return await handleCallback({ issuer, clientId });
          } finally {
            // F6: 인가코드가 URL에 남지 않도록 성공·실패 무관하게 즉시 제거
            // (history/Referer로 새는 것을 막는다. 토큰은 여기서도 출력하지 않는다.)
            try {
              window.history.replaceState({}, '', window.location.pathname);
            } catch {
              // history API 접근 불가 — 치명적이지 않으므로 무시
            }
          }
        })();
        if (!session.idToken) {
          throw new Error('AUTH_ID_TOKEN_MISSING');
        }

        const res = await fetch('/api/users/sso-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: session.idToken, nonce: session.nonce, rememberMe }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setStatus('error');
          setError(data?.error || GENERIC_ERROR);
          return;
        }

        setUserInfo({
          visited: true,
          name: data.nickname,
          org: data.organizationName,
          role: data.position,
          email: data.email,
          corporationName: data.corporationName,
          organizationName: data.organizationName,
          position: data.position,
          userId: data.id,
        });

        // 성공했을 때만 복귀 경로·자동로그인 상태를 소비(삭제)한다.
        try {
          window.sessionStorage.removeItem(NOA_SSO_RETURN_KEY);
          window.sessionStorage.removeItem(NOA_SSO_REMEMBER_KEY);
        } catch {
          // sessionStorage 접근 불가 — 무시(다음 로그인 시도에 영향 없음)
        }
        router.replace(returnPath);
      } catch {
        setStatus('error');
        setError(GENERIC_ERROR);
      }
    })();
    // configured/issuer/clientId는 페이지 수명 동안 불변 — 마운트 1회만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'error') {
    return (
      <Shell>
        <p style={{ margin: 0, fontSize: 14, color: T.danger, lineHeight: 1.6, textAlign: 'center' }}>
          {error}
        </p>
        {/* F10: next를 잃지 않도록 저장해 둔 복귀 경로를 이어 붙인다 */}
        <a
          href={`/login${errorNext !== '/' ? `?next=${encodeURIComponent(errorNext)}` : ''}`}
          style={linkStyle}
        >
          로그인 화면으로 돌아가기
        </a>
      </Shell>
    );
  }

  return (
    <Shell>
      <p style={{ margin: 0, fontSize: 14, color: T.muted }}>로그인 처리 중입니다...</p>
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
