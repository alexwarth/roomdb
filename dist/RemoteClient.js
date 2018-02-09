(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.RemoteClient = factory());
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

// If fetch is not declared, load it from the node-fetch module.
// (This makes it possible to run RemoteClient in the browser and in node-js.)
const fetch = (() => {
  try {
    return fetch;
  } catch (e) {
    return require('node-fetch');
  }
})();

class RemoteClient extends AbstractClient {
  constructor(address, port, id) {
    super(id);
    this._address = address;
    this._port = port;
  }

  select(...patternStrings) {
    const patterns = patternStrings.map(p =>
      p instanceof Array ?
          this._toJSONFactOrPattern(...p) :
          this._toJSONFactOrPattern(p));
    const solutions = async () => {
      const params = `query=${JSON.stringify(patterns)}`;
      const response = await fetch(`http://${this._address}:${this._port}/facts?${params}`);
      return await response.json();
    };
    const results = {
      async do(callbackFn) {
        for (let solution of await solutions()) {
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
        return (await solutions()).length;
      },
      async isEmpty() {
        return (await solutions()).length === 0;
      },
      async isNotEmpty() {
        return (await solutions()).length > 0;
      }
    };
    return results;
  }

  async flushChanges() {
    const retractions = this._retracts;
    const assertions = this._asserts;
    this._retracts = [];
    this._asserts = [];
    const params =
        'clientId=' + this._id + '&' +
        'retractions=' + JSON.stringify(retractions) + '&' +
        'assertions=' + JSON.stringify(assertions);
    const response = await fetch(
        `http://${this._address}:${this._port}/facts?${params}`,
        {method: 'PUT'});
    return await response.json();
  }

  async immediatelyRetractEverythingAbout(name) {
    const response = await fetch(
        `http://${this._address}:${this._port}/facts?clientId=${this._id}&name=${name}`,
        {method: 'DELETE'});
    return await response.json();
  }

  async immediatelyRetractEverythingAssertedByMe() {
    const response = await fetch(
        `http://${this._address}:${this._port}/facts?clientId=${this._id}`,
        {method: 'DELETE'});
    return await response.json();
  }

  async getAllFacts() {
    const response = await fetch(`http://${this._address}:${this._port}/facts`);
    return await response.json();
  }

  toString() {
    return `[RemoteClient ${this._address}:${this._port}, ${this._id}]`;
  }
}

module.exports = RemoteClient;

return RemoteClient;

})));
//# sourceMappingURL=RemoteClient.js.map
