'use strict';

import AbstractClient from './AbstractClient'
import {Term} from './terms'

export default class LocalClient extends AbstractClient {
  constructor(db, id) {
    super(id);
    this._db = db;
  }

  select(...patternStrings) {
    const patterns = patternStrings.map(p =>
      p instanceof Array ?
          this._toJSONFactOrPattern(...p) :
          this._toJSONFactOrPattern(p));
    const solutions = this._db.select(...patterns);
    const results = {
      async doAll(callbackFn) {
        await callbackFn(solutions);
        return results;
      },
      async do(callbackFn) {
        for (let solution of solutions) {
          for (let name in solution) {
            // force serialization and deserialization to simulate going over the network
            const json = JSON.parse(JSON.stringify(solution[name]));
            solution[name] = Term.fromJSON(json).toRawValue();
          }
          await callbackFn(solution);
        }
        return results;
      },
      async count() {
        return solutions.length;
      },
      async isEmpty() {
        return solutions.length === 0;
      },
      async isNotEmpty() {
        return solutions.length > 0;
      }
    };
    return results;
  }

  async flushChanges() {
    this._retracts.forEach(pattern => this._db.retract(this._id, pattern));
    this._retracts = [];
    this._asserts.forEach(fact => this._db.assert(this._id, fact));
    this._asserts = [];
  }

  async immediatelyRetractEverythingAbout(name) {
    return this._db.retractEverythingAbout(this._id, name);
  }

  async immediatelyRetractEverythingAssertedByMe() {
    return this._db.retractEverythingAssertedBy(this._id);
  }

  async getAllFacts() {
    return this._db.getAllFacts();
  }

  toString() {
    return `[LocalClient ${this._id}]`;
  }
}

module.exports = LocalClient;
