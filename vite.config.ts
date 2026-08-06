import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: process.env.DESKTOP_BUILD ? './' : '/Pok-mon-Feuerrot/',
  plugins: [react()],
})
