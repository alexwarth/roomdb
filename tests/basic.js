const test = require('ava')
const RoomDB = require('../dist/roomdb.js')
const room = new RoomDB()
const client = room.connect()

test('basics', t => {
  client
    .assert('#gorog is a barbarian at 50, 50')

  client
    .select('$name is a $what at $x, $y')
    .do(({name, what, x, y}) => {
      t.is(name.name, 'gorog')
      t.is(what.str, 'barbarian')
      t.is(x, 50)
      t.is(y, 50)
    })
})
