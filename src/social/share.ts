import { shareCardBlob, type ShareCardData } from "./share-card";

export interface ShareLinkContext {
  url: string;
  text: string;
}

export function buildShareText(data: ShareCardData): ShareLinkContext {
  const handle = data.username ? `@${data.username}` : "I";
  const verb = data.score === 0 ? "just bombed" : `just scored ${data.score} on`;
  const mode = data.mode === "daily" ? `the daily (${data.dailyDate ?? "today"})` : "Glide";
  // 'Challenge a friend' flow lets us address a specific recipient
  // — the receiver only needs the URL, so this is just copy.
  const callout = data.addressedTo ? ` @${data.addressedTo}, beat me ↓` : ". beat me →";
  const text = `${handle} ${verb} ${mode}${callout}`;
  const params = new URLSearchParams();
  if (data.mode === "daily" && data.dailyDate) params.set("d", data.dailyDate);
  // `?c=` is read on load as the challenge short id (main.ts deep-link
  // handling → fetchChallenge). For a 'Challenge a friend' share that must
  // be the challenge short id so the recipient lands in the ghost run;
  // otherwise the link 404s. Fall back to the friend code for legacy shares.
  if (data.challengeShortId) params.set("c", data.challengeShortId);
  else if (data.friendCode) params.set("c", data.friendCode);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://pflug.app";
  const url = `${baseUrl}/${params.toString() ? `?${params}` : ""}`;
  return { url, text };
}

export interface NativeShareResult {
  ok: boolean;
  method: "native" | "clipboard" | "download";
}

export async function nativeShareOrFallback(data: ShareCardData): Promise<NativeShareResult> {
  const { text, url } = buildShareText(data);
  let file: File | null = null;
  try {
    const blob = await shareCardBlob(data);
    file = new File([blob], `glide-${data.score}.png`, { type: "image/png" });
  } catch (err) {
    console.warn("[share] card render failed", err);
  }

  const navigatorAny = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (file && navigatorAny.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, url });
      return { ok: true, method: "native" };
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return { ok: false, method: "native" };
    }
  }
  if (navigatorAny.canShare?.({ text, url })) {
    try {
      await navigator.share({ text, url });
      return { ok: true, method: "native" };
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return { ok: false, method: "native" };
    }
  }

  // Last resort: copy text + url and trigger PNG download.
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
  } catch {
    /* clipboard may be blocked */
  }
  if (file) downloadFile(file);
  return { ok: true, method: file ? "download" : "clipboard" };
}

export function whatsappUrl({ text, url }: ShareLinkContext): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
}

export function twitterUrl({ text, url }: ShareLinkContext): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

export function tiktokFallbackUrl({ url }: ShareLinkContext): string {
  // TikTok has no public web intent for arbitrary share text. Best
  // effort: route to a copy-paste flow inside the app modal. Keeping
  // the helper here so the UI surface is symmetric.
  return url;
}

export function downloadFile(file: File): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
