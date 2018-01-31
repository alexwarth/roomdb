'use strict';

const RoomDB = require('./RoomDB');
const RemoteClient = require('./RemoteClient');

module.exports = {
  create() {
    return new RoomDB();
  },
  client(address, port, id = 'remote-client') {
    return new RemoteClient(address, port, id);
  }
};
