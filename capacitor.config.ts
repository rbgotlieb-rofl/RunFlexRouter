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
    // StatusBar plugin removed — iOS WebView is always edge-to-edge.
    // Adding StatusBar config can interfere with safe area inset reporting.
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
