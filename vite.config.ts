import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";
import { devApi } from "./dev-api";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
  plugins: [
    devApi(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "favicon.ico", "robots.txt"],
      manifest: {
        name: "Glide",
        short_name: "Glide",
        description: "Daily flap-through-gaps. Same seed for the world, every day.",
        // theme_color paints the Android system UI (status bar) when the app
        // runs installed/standalone. It was #87ceeb — which is exactly
        // `sky.day`, the menu's blue — while index.html's <meta name=
        // "theme-color"> is #000000 and <body> is bg-black. In the browser the
        // meta tag won, so it looked right; installed, the manifest won and
        // painted a sky-blue strip across the top that read as a stray piece
        // of the main menu bleeding out of the game. Black matches both the
        // meta tag and the letterbox bars around the 9:16 stage, so the status
        // bar now blends into the app instead of announcing itself.
        theme_color: "#000000",
        // background_color is the launch splash, shown before any HTML paints.
        // Deliberately still sky blue: index.html's #splash opens with a
        // #87ceeb gradient, so this makes the hand-off seamless.
        background_color: "#87ceeb",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // NOTE the deliberate omission of `webp`. Backgrounds are the only
        // webp assets and they are large (12 files, ~1.4MB); precaching them
        // would block first paint on a payload the player may never see,
        // since only the equipped theme's background is used. They are served
        // from the runtimeCaching rule below instead, so the first view of a
        // background fetches it and every later view (including offline) is
        // cache-served. Sprites stay in the precache: they are needed for the
        // very first frame of the very first run.
        //
        // History: this glob used to include `png` while excluding `webp`,
        // which was exactly backwards — 9 backgrounds had been converted to
        // webp and excluded, while 3 unconverted 1.7MB PNGs were precached.
        // The precache was 6.4MB, 5.1MB of it those three files. They are
        // webp now (migration in this same commit) and the precache is ~1.2MB.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2,ttf}"],
        // Never answer these navigations from the precached index.html:
        // /run/:id is rewritten server-side (vercel.json) to the OG/meta
        // handler that boots a challenge — for installed-PWA users the SW
        // used to swallow it and share links opened a blank menu.
        navigateFallbackDenylist: [/^\/run\//, /^\/api\//],
        runtimeCaching: [
          {
            // Backgrounds: immutable art, fetched on first use then served
            // from cache forever (including offline). CacheFirst because the
            // bytes never change for a given filename — a new background ships
            // under a new name.
            urlPattern: /\/backgrounds\/.*\.webp$/,
            handler: "CacheFirst",
            options: {
              cacheName: "backgrounds",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /\/api\/(leaderboard|daily)/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 5 },
            },
          },
        ],
      },
    }),
  ],
});
