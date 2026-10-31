import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Accept NEXT_PUBLIC_* names too (the names Vercel's Supabase integration uses).
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
})
