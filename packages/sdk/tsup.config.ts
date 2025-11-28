import {
  defineConfig
} from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: "node",
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  target: 'es2024',
  cjsInterop: true,
  outDir: 'dist',
  tsconfig: './tsconfig.json',
  shims: true,
})