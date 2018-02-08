const test = require('ava')
const RoomDB = require('../dist/roomdb.js')
const room = new RoomDB()
const client = room.client()

test('basics', async t => {
  client
    .assert('#gorog is a barbarian at 50, 50')

  await client.flushChanges();

  client
    .select('$name is a $what at $x, $y')
    .do(({name, what, x, y}) => {
      t.is(name.name, 'gorog')
      t.is(what.value, 'barbarian')
      t.is(x, 50)
      t.is(y, 50)
    })
})
