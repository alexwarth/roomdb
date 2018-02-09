(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.RoomDB = factory());
}(this, (function () { 'use strict';

const ohm = require('ohm-js');

const grammar = ohm.grammar(`
  G {

    factOrPattern
      = term*

    term
      = id
      | word
      | value
      | variable
      | wildcard
      | hole

    id
      = "#" alnum*

    value
      = keyword<"true">   -- true
      | keyword<"false">  -- false
      | keyword<"null">   -- null
      | number
      | string

    variable
      = "$" alnum+

    wildcard
      = "$"

    hole
      = "_"

    word
      = (~special any)+  -- nonspace
      | space+           -- space

    keyword<k>
      = k ~alnum

    number
      = float ("e" float)?

    float
      = integer ("." digit+)?

    integer
      = ("+" | "-")? digit+

    string
      = "\\"" (~"\\"" ~"\\n" any)* "\\""

    special
      = id | value | variable | wildcard | hole | space

  }
`);

const semantics = grammar.createSemantics().addOperation('parse', {
  factOrPattern(terms) {
    return terms.parse();
  },
  id(_, cs) {
    return {id: cs.sourceString};
  },
  value_true(_) {
    return {value: true};
  },
  value_false(_) {
    return {value: false};
  },
  value_null(_) {
    return {value: null};
  },
  variable(_, cs) {
    return {variable: cs.sourceString};
  },
  wildcard(_) {
    return {wildcard: true};
  },
  hole(_) {
    return {hole: true};
  },
  word_nonspace(_) {
    return {word: this.sourceString};
  },
  word_space(_) {
    return {word: ' '};
  },
  number(_1, _2, _3) {
    return {value: parseFloat(this.sourceString)};
  },
  string(_oq, cs, _cq) {
    const chars = [];
    let idx = 0;
    cs = cs.parse();
    while (idx < cs.length) {
      let c = cs[idx++];
      if (c === '\\' && idx < cs.length) {
        c = cs[idx++];
        switch (c) {
          case 'n': c = '\n'; break;
          case 't': c = '\t'; break;
          default: idx--;
        }
      }
      chars.push(c);
    }
    return {value: chars.join('')};
  },
  _terminal() {
    return this.sourceString;
  }
});

function parse(str, optRule) {
  const rule = optRule || 'factOrPattern';
  const matchResult = grammar.match(str.trim(), rule);
  if (matchResult.succeeded()) {
    return semantics(matchResult).parse();
  } else {
    throw new Error(`invalid ${rule}: ${str}`);
  }
}

const MAX_PARSE_CACHE_SIZE = 1000;

class AbstractClient {
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
    this.assert(patternString, ...fillerValues);
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

class Term {
  toString() {
    throw new Error('subclass responsibility');
  }

  toJSON() {
    throw new Error('subclass responsibility');
  }

  toRawValue() {
    throw new Error('subclass responsibility');
  }

  match(that, env) {
    throw new Error('subclass responsibility');
  }
}

Term.fromJSON = json => {
  if (json.hasOwnProperty('id')) {
    return new Id(json.id);
  } else if (json.hasOwnProperty('word')) {
    return new Word(json.word);
  } else if (json.hasOwnProperty('value')) {
    return new Value(json.value);
  } else if (json.hasOwnProperty('blobRef')) {
    return new BlobRef(json.blobRef);
  } else if (json.hasOwnProperty('variable')) {
    return new Variable(json.variable);
  } else if (json.hasOwnProperty('wildcard')) {
    return new Wildcard();
  } else if (json.hasOwnProperty('hole')) {
    return new Hole();
  } else {
    throw new Error('unrecognized JSON term: ' + JSON.stringify(json));
  }
};

class Id extends Term {
  constructor(name) {
    super();
    this.name = name;
  }

  toString() {
    return '#' + this.name;
  }

  toJSON() {
    return {id: this.name};
  }

  toRawValue() {
    return this;
  }

  match(that, env) {
    return that instanceof Id && this.name === that.name ?
        env :
        null;
  }
}

class Word extends Term {
  constructor(value) {
    super();
    this.value = value;
  }

  toString() {
    return this.value;
  }

  toJSON() {
    return {word: this.value};
  }

  toRawValue() {
    return this;
  }

  match(that, env) {
    return that instanceof Word && this.value === that.value ?
        env :
        null;
  }
}

class Value extends Term {
  constructor(value) {
    super();
    this.value = value;
  }

  toString() {
    return JSON.stringify(this.value);
  }

  toJSON() {
    return {value: this.value};
  }

  toRawValue() {
    return this.value;
  }

  match(that, env) {
    return that instanceof Value && this.value === that.value ?
        env :
        null;
  }
}

class BlobRef extends Term {
  constructor(id) {
    super();
    this.id = id;
  }

  toString() {
    return '@' + this.id;
  }

  toJSON() {
    return {blobRef: this.id};
  }

  toRawValue() {
    return this;
  }

  match(that, env) {
    return that instanceof BlobRef && this.id === that.id ?
        env :
        null;
  }
}

class Variable extends Term {
  constructor(name) {
    super();
    this.name = name;
  }

  toString() {
    return '$' + this.name;
  }

  toJSON() {
    return {variable: this.name};
  }

  toRawValue() {
    throw new Error('Variable\'s toRawValue() should never be called!');
  }

  match(that, env) {
    if (env[this.name] === undefined) {
      env[this.name] = that;
      return env;
    } else {
      return env[this.name].match(that, env);
    }
  }
}

class Wildcard extends Term {
  constructor() {
    super();
    // no-op
  }

  toString() {
    return '$';
  }

  toJSON() {
    return {wildcard: true};
  }

  toRawValue() {
    throw new Error('Wildcard\'s toRawValue() should never be called!');
  }

  match(that, env) {
    return env;
  }
}

class Hole extends Term {
  constructor() {
    super();
    // no-op
  }

  toString() {
    return '_';
  }

  toJSON() {
    return {hole: true};
  }

  toRawValue() {
    throw new Error('Hole\'s toRawValue() should never be called!');
  }

  match(that, env) {
    throw new Error('Hole\'s match() should never be called!');
  }
}

class LocalClient extends AbstractClient {
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

class Fact {
  constructor(terms) {
    this.terms = terms;
  }

  hasVariablesOrWildcards() {
    return this.terms.some(term =>
        term instanceof Variable ||
        term instanceof Wildcard);
  }

  match(that, env) {
    if (this.terms.length !== that.terms.length) {
      return null;
    }
    for (let idx = 0; idx < this.terms.length; idx++) {
      const thisTerm = this.terms[idx];
      const thatTerm = that.terms[idx];
      if (!thisTerm.match(thatTerm, env)) {
        return null;
      }
    }
    return env;
  }

  toString() {
    return this.terms.map(term => term.toString()).join('');
  }
}

Fact.fromJSON =
    jsonTerms => new Fact(jsonTerms.map(jsonTerm => Term.fromJSON(jsonTerm)));

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
      for (let fact of this._facts) {
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
          this._facts.filter(fact => pattern.match(fact, Object.create(null)));
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
        this._facts.filter(fact => fact.terms.some(term => id.match(term, emptyEnv)));
    factsToRetract.forEach(fact => this._factMap.delete(fact.toString()));
    return factsToRetract.length;
  }

  retractEverythingAssertedBy(clientId) {
    const factsToRetract = this._facts.filter(fact => fact.asserter === clientId);
    factsToRetract.forEach(fact => this._factMap.delete(fact.toString()));
    return factsToRetract.length;
  }

  get _facts() {
    return Array.from(this._factMap.values());
  }

  getAllFacts() {
    return this._facts.map(fact => fact.toString());
  }

  toString() {
    return this._facts.map(fact => '<' + fact.asserter + '> ' + fact.toString()).join('\n');
  }

  client(id = 'local-client') {
    return new LocalClient(this, id);
  }
}

return RoomDB;

})));
//# sourceMappingURL=RoomDB.js.map
