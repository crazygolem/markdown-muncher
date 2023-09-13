import commonjs from '@rollup/plugin-commonjs'            // Remark depends on some CJS libraries
import nodepolyfills from 'rollup-plugin-polyfill-node'   // Browser polyfills for node builtins
import resolve from '@rollup/plugin-node-resolve'         // Resolve node dependencies from node_modules
import terser from '@rollup/plugin-terser'                // Minifier

export default [{
  input: 'index.js',
  output: {
    file: 'dist/markdown-muncher.mjs',
    format: 'es',
    compact: false,
  },
  plugins: [commonjs(), nodepolyfills(), resolve({ preferBuiltins: false })],
}, {
  input: 'dist/markdown-muncher.mjs',
  output: {
    file: 'dist/markdown-muncher.min.mjs',
    format: 'es',
    compact: true,
  },
  plugins: [terser()],
}];
