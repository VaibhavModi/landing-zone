import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

function spa404Plugin() {
  return {
    name: 'spa-404',
    apply: 'build',
    closeBundle() {
      const dist = resolve('dist');
      let html = readFileSync(resolve(dist, 'index.html'), 'utf8');
      html = html.replace(/\s*<link rel="canonical"[^>]*>\s*/i, '\n');
      html = html.replace(
        /\s*<link\s+rel="preload"\s+as="image"[\s\S]*?\/>\s*/i,
        '\n'
      );
      if (!html.includes('name="robots"')) {
        html = html.replace(
          '</title>',
          '</title>\n    <meta name="robots" content="noindex" />'
        );
      }
      writeFileSync(resolve(dist, '404.html'), html);
    },
  };
}

export default defineConfig({
  plugins: [react(), spa404Plugin()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
});
