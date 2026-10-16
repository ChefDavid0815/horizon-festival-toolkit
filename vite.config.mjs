import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
// Fonts stay as files: the renderer CSP allows font-src 'self' only, so data: URIs would be blocked.
export default defineConfig({plugins:[react()],base:'./',build:{assetsInlineLimit:file=>file.endsWith('.woff2')?false:undefined}});
