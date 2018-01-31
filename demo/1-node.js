'use strict';

const roomdb = require('../src/roomdb-node');

const db = roomdb.create().listen(8080);
const localClient = db.client('Lola');
const remoteClient = roomdb.client('localhost', 8080, 'MrRemoto');

async function main() {
  console.log('facts:\n' + db + '\n');

  remoteClient.assert(`#obj1 is a "circle" at (300, 400)`);
  remoteClient.assert(`the answer is 42`);
  await remoteClient.flushChanges();
  console.log('\nfacts:\n' + db + '\n');

  for (let n = 1; n <= 10; n++) {
    remoteClient.assert(`_ is a number`, n);
  }
  await remoteClient.flushChanges();
  console.log('\nfacts:\n' + db + '\n');

  await localClient.select(`$n is a number`).do(({n}) => {
    if (n % 2 === 1) {
      localClient.retract(`_ is a number`, n);
    }
  });
  localClient.flushChanges();
  console.log('\nfacts:\n' + db + '\n');

  await remoteClient.select(`$o is a "circle" at ($x, $y)`).do(vars => {
    console.log(Object.keys(vars).map(key => key + '=' + vars[key]).join(', '));
  });
  await remoteClient.select(`the answer is $ans`).do(vars => {
    console.log(Object.keys(vars).map(key => key + '=' + vars[key]).join(', '));
  });

  localClient.assert('blah blah blah');
  await localClient.flushChanges();
  await localClient.immediatelyRetractEverythingAbout('obj1');
  console.log('\nfacts:\n' + db + '\n');
}

main();
