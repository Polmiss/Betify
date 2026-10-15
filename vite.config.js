import { defineConfig } from 'vite';

export default defineConfig({
  // Relative assets also work under GitHub Pages' /Betify/ subdirectory.
  base: './',
  build: { rollupOptions: { input: { lobby: 'index.html', game: 'game.html' } } },
});
