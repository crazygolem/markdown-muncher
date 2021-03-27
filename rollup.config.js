import commonjs from '@rollup/plugin-commonjs'            // Remark is written in CJS
import nodepolyfills from 'rollup-plugin-node-polyfills'  // Browser polyfills for node builtins
import resolve from '@rollup/plugin-node-resolve'         // Resolve node dependencies from node_modules
import json from '@rollup/plugin-json'                    // Convert .json files to ES6 modules

import closure from '@ampproject/rollup-plugin-closure-compiler'

export default [{
  input: 'index.js',
  output: {
    file: 'dist/markdown-muncher.mjs',
    format: 'es',
    compact: true,
  },
  plugins: [commonjs(), nodepolyfills(), resolve({ preferBuiltins: false }), json()],
}, {
  input: 'index.js',
  output: {
    file: 'dist/markdown-muncher.min.mjs',
    format: 'es',
    compact: true,
  },
  plugins: [commonjs(), nodepolyfills(), resolve({ preferBuiltins: false }), json(), closure()],
}];
