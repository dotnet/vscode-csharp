import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';
import nodeResolve from 'rollup-plugin-node-resolve';
import typescript from 'rollup-plugin-typescript2';
import uglify from 'rollup-plugin-uglify';

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
      include: 'node_modules/**',  // Default: undefined
    //   exclude: [ 'node_modules/foo/**', 'node_modules/bar/**' ],  // Default: undefined
      // these values can also be regular expressions
      // include: /node_modules/

      // search for files other than .js files (must already
      // be transpiled by a previous plugin!)
    //   extensions: [ '.js', '.coffee' ],  // Default: [ '.js' ]

      // if true then uses of `global` won't be dealt with by this plugin
    //   ignoreGlobal: false,  // Default: false

      // if false then skip sourceMap generation for CommonJS modules
    //   sourceMap: false,  // Default: true

      // explicitly specify unresolvable named exports
      // (see below for more details)
    //   namedExports: { './module.js': ['foo', 'bar' ] },  // Default: undefined

      // sometimes you have to leave require statements
      // unconverted. Pass an array containing the IDs
      // or a `id => boolean` function. Only use this
      // option if you know what you're doing!
    //   ignore: [ 'conditional-runtime-dependency' ]
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
    typescript({
        tsconfigOverride: {
            compilerOptions: {
                module: "ES2015"
            }
        }
    }),
    //uglify()
  ]
};