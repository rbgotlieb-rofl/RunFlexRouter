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
    // App loads from bundled files (enables native plugins like GPS).
    // Auth uses token-based Authorization header instead of cookies.
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
