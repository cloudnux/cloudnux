import {
  defineConfig
} from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  target: 'node18',
  outDir: 'dist',
  noExternal: [/.*/],
  external: [],
  tsconfig: './tsconfig.json',
  esbuildOptions(options) {
    options.conditions = ['module']
  },
})