'use strict';

const RoomDB = require('./RoomDB');
RoomDB.prototype.listen = require('./listen');

module.exports = require('./roomdb-web');
