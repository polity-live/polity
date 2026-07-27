const DEVICE_STORAGE_KEY = 'polity.push.device-id.v1';

function storedUuid(storage: Storage, key: string) {
  const existing = storage.getItem(key);
  if (existing) return existing;
  const value = crypto.randomUUID();
  storage.setItem(key, value);
  return value;
}

export function getPushDeviceId() {
  if (typeof window === 'undefined') return null;
  return storedUuid(window.localStorage, DEVICE_STORAGE_KEY);
}

export function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isStandalonePwa() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function requiresIosHomeScreenInstall() {
  return isIosDevice() && !isStandalonePwa();
}
