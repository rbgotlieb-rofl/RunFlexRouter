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
  },
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: false,
    backgroundColor: '#ffffff',
  },
};

export default config;
