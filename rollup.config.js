import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';
import nodeResolve from 'rollup-plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
import uglify from 'rollup-plugin-uglify';
import sourceMaps from 'rollup-plugin-sourcemaps';

export default {
  input: 'src/main.ts',
  output: {
    file: 'out/main.js',
    format: 'cjs',
    sourcemap: 'inline'
  },
  plugins: [
    commonjs({
      // non-CommonJS modules will be ignored, but you can also
      // specifically include/exclude files
      include: 'node_modules/**',
      sourceMap: true
    }),
    json({
        // All JSON files will be parsed by default,
        // but you can also specifically include/exclude files
        include: 'node_modules/**',
        
        // for tree-shaking, properties will be declared as
        // variables, using either `var` or `const`
        preferConst: true, // Default: false
  
        // specify indentation for the generated default export —
        // defaults to '\t'
        indent: '  '
      }),
    nodeResolve({
      jsnext: true,
      main: true
    }),
    sourceMaps(),
    typescript({
        tsconfigOverride: {
            compilerOptions: {
                sourceMap: true,
                inlineSourceMap: false,
                module: "ES2015"
            }
        }
    }),
    //uglify()
  ]
};