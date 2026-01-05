import { defineConfig, type Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'
import { rename, mkdir } from 'fs/promises'

function moveHtmlToFolders(): Plugin {
  return {
    name: 'move-html-to-folders',
    closeBundle: async () => {
      const pages = ['admin', 'local', 'script']
      for (const page of pages) {
        const src = resolve(__dirname, `dist/${page}.html`)
        const dir = resolve(__dirname, `dist/${page}`)
        const dest = resolve(dir, 'index.html')
        try {
          await mkdir(dir, { recursive: true })
          await rename(src, dest)
        } catch {}
      }
    },
  }
}

export default defineConfig({
  plugins: [svelte(), moveHtmlToFolders()],
  resolve: {
    alias: {
      $lib: resolve(__dirname, 'src/lib'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        local: resolve(__dirname, 'local.html'),
        script: resolve(__dirname, 'script.html'),
      },
    },
  },
  server: {
    port: 1420,
  },
})
