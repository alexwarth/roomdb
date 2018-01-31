# RoomDB

RoomDB is a Datalog-style database inspired by the implementation of the [Dynamicland](https://dynamicland.org/) project. It enables programmers to represent facts using natural language, with a syntax adapted from my [NL-Datalog project](https://github.com/harc/nl-datalog).

## Examples


```javascript
const RoomDB = require('./dist/roomdb.js')
const room = new RoomDB()
const client = room.connect()

client
  .assert('#gorog is a barbarian at 50, 60')

client
  .select('$name is a $what at $x, $y')
  .do(({name, what, x, y}) => {
    console.log(name.name) // 'gorog'
    console.log(what.str)  // 'barbarian'
    console.log(x)         // 50
    console.log(y)         // 60
  })
```
