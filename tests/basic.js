const test = require('ava')
const pkg = require('../package.json')
const RoomDB = require(`../${pkg.main}`)
const room = new RoomDB()

test('basics', t => {
  const client = room.client()

  client.assert('#gorog is a barbarian at 50, 50')
  client.flushChanges()

  client
    .select('$name is a $what at $x, $y')
    .do(({name, what, x, y}) => {
      t.is(name.name, 'gorog')
      t.is(what.value, 'barbarian')
      t.is(x, 50)
      t.is(y, 50)
    })
})
