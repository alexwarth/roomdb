'use strict';

const LocalClient = require('./LocalClient');
const RemoteClient = require('./RemoteClient');
const Fact = require('./Fact');
const {Id} = require('./terms');

function flatten(obj) {
  for (let prop in obj) {
    obj[prop] = obj[prop];
  }
  return obj;
}

class RoomDB {
  constructor() {
    this._factMap = new Map();
  }

  select(...jsonPatterns) {
    const patterns = jsonPatterns.map(jsonPattern => Fact.fromJSON(jsonPattern));
    const solutions = [];
    this._collectSolutions(patterns, Object.create(null), solutions);
    return solutions.map(flatten);
  }

  _collectSolutions(patterns, env, solutions) {
    if (patterns.length === 0) {
      solutions.push(env);
    } else {
      const pattern = patterns[0];
      for (let fact of this.facts) {
        const newEnv = Object.create(env);
        if (pattern.match(fact, newEnv)) {
          this._collectSolutions(patterns.slice(1), newEnv, solutions);
        }
      }
    }
  }

  assert(clientId, factJSON) {
    const fact = Fact.fromJSON(factJSON);
    if (fact.hasVariablesOrWildcards()) {
      throw new Error('cannot assert a fact that has variables or wildcards!');
    }
    fact.asserter = clientId;
    this._factMap.set(fact.toString(), fact);
  }

  retract(clientId, factJSON) {
    const pattern = Fact.fromJSON(factJSON);
    if (pattern.hasVariablesOrWildcards()) {
      const factsToRetract =
          this.facts.filter(fact => pattern.match(fact, Object.create(null)));
      factsToRetract.forEach(fact => this._factMap.delete(fact.toString()));
      return factsToRetract.length;
    } else {
      return this._factMap.delete(pattern.toString()) ? 1 : 0;
    }
  }

  retractEverythingAbout(clientId, name) {
    const id = new Id(name);
    const emptyEnv = Object.create(null);
    const factsToRetract =
        this.facts.filter(fact => fact.terms.some(term => id.match(term, emptyEnv)));
    factsToRetract.forEach(fact => this._factMap.delete(fact.toString()));
    return factsToRetract.length;
  }

  retractEverythingAssertedBy(clientId) {
    const factsToRetract = this.facts.filter(fact => fact.asserter === clientId);
    factsToRetract.forEach(fact => this._factMap.delete(fact.toString()));
    return factsToRetract.length;
  }

  get facts() {
    return Array.from(this._factMap.values());
  }

  toString() {
    return this.facts.map(fact => '<' + fact.asserter + '> ' + fact.toString()).join('\n');
  }

  client(id = 'local-client') {
    return new LocalClient(this, id);
  }
}

module.exports = RoomDB;
