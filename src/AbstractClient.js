'use strict';

import parse from './parse'

const MAX_PARSE_CACHE_SIZE = 1000;

export default class AbstractClient {
  constructor(id) {
    this._id = id;
    this._parseCache = new Map();
    this._asserts = [];
    this._retracts = [];
  }

  assert(factString, ...fillerValues) {
    const fact = this._toJSONFactOrPattern(factString, ...fillerValues);
    this._asserts.push(fact);
  }

  retract(patternString, ...fillerValues) {
    const pattern = this._toJSONFactOrPattern(patternString, ...fillerValues);
    this._retracts.push(pattern);
  }

  async flushChanges() {
    throw new Error('subclass responsibility');
  }

  async immediatelyAssert(factString, ...fillerValues) {
    this.assert(factString, ...fillerValues);
    await this.flushChanges();
  }

  async immediatelyRetract(patternString, ...fillerValues) {
    this.retract(patternString, ...fillerValues);
    await this.flushChanges();
  }

  async immediatelyRetractEverythingAbout(name) {
    throw new Error('subclass responsibility');
  }

  async immediatelyRetractEverythingAssertedByMe() {
    throw new Error('subclass responsibility');
  }

  async getAllFacts() {
    throw new Error('subclass responsibility');
  }

  _toJSONFactOrPattern(factOrPatternString, ...fillerValues) {
    if (arguments.length === 0) {
      throw new Error('not enough arguments!');
    }
    if (typeof factOrPatternString !== 'string') {
      throw new Error('factOrPatternString must be a string!');
    }
    let terms = this._parse(factOrPatternString);
    if (fillerValues.length > 0) {
      terms = terms.slice();
    }
    for (let idx = 0; idx < terms.length; idx++) {
      const term = terms[idx];
      if (term.hasOwnProperty('hole')) {
        if (fillerValues.length === 0) {
          throw new Error('not enough filler values!');
        }
        terms[idx] = this._toJSONTerm(fillerValues.shift());
      }
    }
    if (fillerValues.length > 0) {
      throw new Error('too many filler values!');
    }
    return terms;
  }

  _toJSONTerm(value) {
    return {value: value};
  }

  _parse(factOrPatternString) {
    if (this._parseCache.has(factOrPatternString)) {
      return this._parseCache.get(factOrPatternString);
    } else {
      this._clearParseCacheIfTooBig();
      const terms = parse(factOrPatternString);
      this._parseCache.set(factOrPatternString, terms);
      return terms;
    }
  }

  _clearParseCacheIfTooBig() {
    if (this._parseCache.size > MAX_PARSE_CACHE_SIZE) {
      this.clearParseCache();
    }
  }

  clearParseCache() {
    this._parseCache.clear();
  }
}
