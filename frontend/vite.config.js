import { defineConfig } from 'vite';
// 로컬 브라우저 요청은 동일 출처 프록시를 거쳐 Spring으로 전달합니다.
export default defineConfig({server:{proxy:{'/api':'http://localhost:8080'}}});
