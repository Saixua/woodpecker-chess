import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['app-icon.jpg', 'sounds/*.mp3', 'sounds/robot/*.mp3', 'sounds/*.ogg', 'chess-pieces/*.png', 'lichess_puzzles.json'],
      workbox: {
        maximumFileSizeToCacheInBytes: 5000000
      },
      manifest: {
        name: "Woodpecker Chess",
        short_name: "Woodpecker",
        description: "A tactical chess training program based on the Woodpecker Method.",
        start_url: "./",
        display: "standalone",
        background_color: "#121212",
        theme_color: "#1e1c19",
        icons: [
          {
            src: "./app-icon.jpg",
            sizes: "512x512",
            type: "image/jpeg",
            purpose: "any maskable"
          }
        ]
      }
    })
  ],
  base: './',
})
