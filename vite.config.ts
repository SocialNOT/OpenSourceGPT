import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    define: {
      // Prioritize GEMINI_API_KEY from Vercel env, fallback to .env file, fallback to API_KEY
      'process.env.API_KEY': JSON.stringify(
        process.env.GEMINI_API_KEY || 
        env.GEMINI_API_KEY || 
        process.env.API_KEY || 
        env.API_KEY
      ),
    },
    build: {
      outDir: 'dist',
      sourcemap: false, // Disable sourcemaps for production to reduce build size/time
      minify: 'esbuild', // Use esbuild for faster minification
    }
  }
})