import { defineConfig } from 'vite';

const authProxy = { '/api/v1/auth': {target: 'http://127.0.0.1:8000', cookieDomainRewrite: ''} };

export default defineConfig({
  base: './',
  server: { proxy: authProxy },
  preview: { proxy: authProxy },
  build: {
    target: 'es2022',
    rolldownOptions: { input: { game: 'index.html', login: 'login.html' } }
  }
});
