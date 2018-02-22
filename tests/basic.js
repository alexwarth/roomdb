const test = require('ava')
const RoomDB = require('../dist/roomdb.js')
const room = new RoomDB()
const client = room.connect()

test('basics', t => {
  client.assert('#gorog is a barbarian at 40, 50')
  client.retract('#gorog is a barbarian at $x, $y')
  client.assert('#gorog is a barbarian at 99, 11')
  client.flushChanges()

  client
    .select('$name is a $what at $x, $y')
    .do(({name, what, x, y}) => {
      t.is(name.name, 'gorog')
      t.is(what.str, 'barbarian')
      t.is(x, 99)
      t.is(y, 11)
    })
})
