import commonjs from 'rollup-plugin-commonjs'
import resolve from 'rollup-plugin-node-resolve'
import uglify from 'rollup-plugin-uglify'

const production = process.env.NODE_ENV !== 'development'

export default {
  input: 'src/RoomDB.js',
  output: {
    file: `build/roomdb${production && '.min' || ''}.js`,
    name: 'roomdb',
    format: 'umd',
    sourcemap: true
  },
  plugins: [
    commonjs(),
    resolve(),
    production && uglify()
  ]
}
