import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'kr.co.eland.aicampus',
  appName: 'Eland AI 캠퍼스',
  webDir: 'public',
  server: {
    url: 'https://test-ai-campus.vercel.app/m',
    androidScheme: 'https',
    cleartext: false,
    allowNavigation: [
      'test-ai-campus.vercel.app',
      '*.vercel.app',
    ],
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
