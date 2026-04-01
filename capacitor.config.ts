import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.runflex.app',
  appName: 'RunFlex',
  webDir: 'dist/public',
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: false,
      splashImmersive: false,
    },
    Geolocation: {
      // iOS requires these keys in Info.plist (set via Xcode or manually)
    },
  },
  server: {
    // Load the app from Railway directly instead of bundled files.
    // This makes ALL requests same-origin, so cookies work without
    // any cross-origin/ITP issues. The app needs internet anyway
    // (routes, maps, auth), so this has no practical downside.
    url: 'https://runflexrouter-production.up.railway.app',
    allowNavigation: ['runflexrouter-production.up.railway.app'],
  },
  ios: {
    // No contentInset — the default lets viewport-fit=cover work correctly,
    // making env(safe-area-inset-*) return proper values for all iPhone models.
    allowsLinkPreview: false,
    backgroundColor: '#ffffff',
    preferredContentMode: 'mobile',
  },
};

export default config;
