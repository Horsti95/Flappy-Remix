import { registerSW } from "virtual:pwa-register";

export function setupPWA(): void {
  if (import.meta.env.DEV) return;
  registerSW({
    immediate: true,
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => {
        registration.update().catch(() => {});
      }, 60 * 60 * 1000);
    },
  });
}
