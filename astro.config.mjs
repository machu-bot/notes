// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://machu-bot.github.io',
  base: '/notes',
  build: {
    format: 'directory',
  },
  output: 'static',
});
