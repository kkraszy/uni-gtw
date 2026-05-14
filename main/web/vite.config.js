import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'
import { paraglideVitePlugin } from '@inlang/paraglide-js'

export default {
  plugins: [
    tailwindcss(),
    preact(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'app.js',
        assetFileNames: (info) => info.names.some((n) => n.endsWith('.css')) ? 'app.css' : info.names[0],
      }
    }
  }
}
