import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// proxy /api -> backend Node.js ที่ port 3001
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
