import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import uglify from 'rollup-plugin-uglify'

const production = process.env.NODE_ENV !== 'development'

const make = name => ({
  input: `src/${name}.js`,
  output: {
    file: `dist/${name + ((production && '.min') || '')}.js`,
    name: name,
    format: 'umd',
    sourcemap: true
  },
  plugins: [
    commonjs(),
    resolve(),
    production && uglify()
  ]
})

export default ['RoomDB', 'RemoteClient'].map(make)
