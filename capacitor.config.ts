import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.deepak.interviewcoach',
  appName: 'Interview Coach',
  webDir: 'www',
  server: {
    url: 'https://ai-interview-coach-phi-gules.vercel.app',
    cleartext: false
  }
};

export default config;
