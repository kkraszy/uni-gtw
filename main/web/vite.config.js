import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'

export default {
  plugins: [tailwindcss(), preact()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'app.js',
        assetFileNames: (info) => info.names.some((n) => n.endsWith('.css')) ? 'app.css' : info.names[0],
      }
    }
  }
}
