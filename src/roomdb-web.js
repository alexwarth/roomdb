'use strict';

const RoomDB = require('../dist/RoomDB');
const RemoteClient = require('../dist/RemoteClient');

module.exports = {
  create() {
    return new RoomDB();
  },
  client(address, port, id = 'remote-client') {
    return new RemoteClient(address, port, id);
  }
};
