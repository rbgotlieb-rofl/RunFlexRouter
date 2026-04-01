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
    CapacitorHttp: {
      // Route all fetch() calls through native HTTP engine.
      // This bypasses WKWebView's third-party cookie blocking (ITP),
      // so session cookies work for cross-origin requests to Railway.
      enabled: true,
    },
    Geolocation: {
      // iOS requires these keys in Info.plist (set via Xcode or manually)
    },
  },
  server: {
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
