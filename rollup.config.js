import pkg from './package.json'
import resolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import uglify from 'rollup-plugin-uglify'
import standard from 'rollup-plugin-standard'

const production = process.env.NODE_ENV !== 'development'

export default {
  input: 'src/RoomDB.js',
  output: {
    file: (production && pkg.main.replace('.js', '.min.js')) || pkg.main,
    name: 'room',
    format: 'umd',
    sourcemap: true
  },
  plugins: [
    commonjs(),
    resolve(),
    standard(),
    production && uglify()
  ]
}
