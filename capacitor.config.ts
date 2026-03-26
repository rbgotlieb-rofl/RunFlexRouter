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
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#ffffff',
    },
    Geolocation: {
      // iOS requires these keys in Info.plist (set via Xcode or manually)
    },
  },
  server: {
    // Allow the WebView to reach the Railway backend
    allowNavigation: ['runflexrouter-production.up.railway.app'],
  },
  ios: {
    contentInset: 'never',
    allowsLinkPreview: false,
    backgroundColor: '#ffffff',
    preferredContentMode: 'mobile',
  },
};

export default config;
