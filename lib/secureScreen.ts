interface SecureScreenPlugin {
  setSecure(options: { secure: boolean }): Promise<void>;
}

let cachedPlugin: SecureScreenPlugin | null = null;
let cachedIsNative: boolean | null = null;

async function getPlugin(): Promise<SecureScreenPlugin | null> {
  if (typeof window === 'undefined') return null;
  if (cachedPlugin) return cachedPlugin;

  try {
    const { Capacitor, registerPlugin } = await import('@capacitor/core');
    if (cachedIsNative === null) cachedIsNative = Capacitor.isNativePlatform();
    if (!cachedIsNative) return null;
    cachedPlugin = registerPlugin<SecureScreenPlugin>('SecureScreen');
    return cachedPlugin;
  } catch {
    return null;
  }
}

export async function enableSecureScreen(): Promise<void> {
  const plugin = await getPlugin();
  if (!plugin) return;
  try {
    await plugin.setSecure({ secure: true });
  } catch (e) {
    console.warn('[SecureScreen] enable failed', e);
  }
}

export async function disableSecureScreen(): Promise<void> {
  const plugin = await getPlugin();
  if (!plugin) return;
  try {
    await plugin.setSecure({ secure: false });
  } catch (e) {
    console.warn('[SecureScreen] disable failed', e);
  }
}
