import { defineConfig } from 'rolldown'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'

export default defineConfig({
  input: 'src/index.ts',
  output: {
    file: 'dist/index.js',
    format: 'esm',
    exports: 'auto'
  },
  external: [/node_modules/],
  plugins: [
    nodeResolve(),
    terser({
      output: {
        ascii_only: true
      }
    })
  ]
})
