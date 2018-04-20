'use strict';

const RoomDB = require('../dist/RoomDB')
RoomDB.prototype.listen = require('./listen');

module.exports = require('./roomdb-web');
