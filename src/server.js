'use strict';

const roomdb = require('./roomdb-node');

let port;

if (process.argv.length === 3) {
  port = parseInt(process.argv[2]);
} else if (process.argv.length < 3) {
  port = 8080;
} else {
  console.error('usage:', process.argv[0], process.argv[1], '[portNumber]');
  process.exit(1);
}

roomdb.create().listen(port);
