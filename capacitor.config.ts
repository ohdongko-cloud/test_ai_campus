import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'kr.co.eland.aicampus',
  appName: 'Eland AI 캠퍼스',
  webDir: 'public',
  server: {
    url: 'https://retail-ai-campus.vercel.app/m',
    androidScheme: 'https',
    cleartext: false,
    allowNavigation: [
      'retail-ai-campus.vercel.app',
      '*.vercel.app',
      // NoA Vibe 사내 SSO(Keycloak) — 없으면 WebView가 로그인 리다이렉트를
      // 외부 브라우저로 튕겨 PKCE verifier(sessionStorage)를 잃고 100% 실패한다.
      'auth.noa.eland.com',
    ],
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
