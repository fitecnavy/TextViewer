import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.textviewer.app',
  appName: 'TextViewer',
  webDir: 'src',
  server: {
    androidScheme: 'https'
  }
};

export default config;
