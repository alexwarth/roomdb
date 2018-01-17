'use strict';

// TODO: consider space-insensitive matching for facts
// (would need a canonical representation to use as keys for factMap)

// TODO: think about primary keys

class RoomDB {
  constructor() {
    this.parseCache = new Map();
    this.factMap = new Map();
    this.nextClientId = 1;
    this.clientMap = new Map();
  }

  connect(id = this.newClientId()) {
    if (this.clientMap.has(id)) {
      throw new Error('there is already a client whose id is ' + id);
    }
    const client = new Client(id, this);
    this.clientMap.set(id, client);
    return client;
  }

  newClientId() {
    return '_' + this.nextClientId++;
  }

  select(...patterns) {
    patterns = patterns.map(pattern =>
        pattern instanceof Array ?
            this.makeFactOrPattern(...pattern) :
            this.makeFactOrPattern(pattern));
    const solutions = [];
    this.collectSolutions(patterns, Object.create(null), solutions);
    return {
      do(callbackFn) {
        for (let solution of solutions) {
          for (let name in solution) {
            solution[name] = solution[name].toRawValue();
          }
          callbackFn(solution);
        }
      },
      count() {
        return solutions.length;
      },
      isEmpty() {
        return solutions.length === 0;
      },
      isNotEmpty() {
        return solutions.length > 0;
      }
    };
  }

  collectSolutions(patterns, env, solutions) {
    if (patterns.length === 0) {
      solutions.push(env);
    } else {
      const pattern = patterns[0];
      for (let fact of this.facts) {
        const newEnv = Object.create(env);
        if (pattern.match(fact, newEnv)) {
          this.collectSolutions(patterns.slice(1), newEnv, solutions);
        }
      }
    }
  }

  assert(asserterClientId, factString, ...fillerValues) {
    const fact = this.makeFactOrPattern(factString, ...fillerValues);
    fact.asserter = asserterClientId;
    if (fact.hasVars()) {
      throw new Error('cannot assert a fact that has vars!');
    }
    fact.evidence = [];
    this.factMap.set(fact.toString(), fact);
    return {
      withEvidence: (...evidence) => {
        evidence = evidence.map(e => this.makeFactOrPattern(e));
        const evidenceWithVars = evidence.filter(e => e.hasVars());
        if (evidenceWithVars.length > 0) {
          console.error('the following evidence has vars:');
          evidenceWithVars.forEach(e => console.info(e.toString()));
          throw new Error('evidence facts cannot have vars!');
        }
        const falseEvidence = evidence.filter(e => !this.factMap.has(e.toString()));
        if (falseEvidence.length > 0) {
          console.error('the following evidence is not in the database:');
          falseEvidence.forEach(e => console.info(e.toString()));
          throw new Error('evidence facts must be in the database!');
        }
        fact.evidence = evidence;
      }
    };
  }

  retract(factString, ...fillerValues) {
    const factOrPattern = this.makeFactOrPattern(factString, ...fillerValues);
    if (factOrPattern.hasVars()) {
      const factsToRetract = [];
      for (let fact of this.facts) {
        if (factOrPattern.match(fact, Object.create(null))) {
          factsToRetract.push(fact);
        }
      }
      for (let fact of factsToRetract) {
        this.factMap.delete(fact.toString());
      }
      return factsToRetract.length;
    } else {
      return this.factMap.delete(factOrPattern.toString()) ? 1 : 0;
    }
    return count;
  }

  retractEverythingAbout(idString) {
    const id = this.parse(idString, 'identity');
    const factsToRetract = [];
    const emptyEnv = Object.create(null);
    for (let fact of this.facts) {
      if (fact.terms.some(term => id.match(term, emptyEnv))) {
        factsToRetract.push(fact);
      }
    }
    for (let fact of factsToRetract) {
      this.factMap.delete(fact.toString());
    }
    return factsToRetract.length;
  }

  retractEverythingAssertedBy(clientId) {
    const factsToRetract = this.facts.filter(fact => fact.asserter === clientId);
    for (let fact of factsToRetract) {
      this.factMap.delete(fact.toString());
    }
    return factsToRetract.length;
  }

  makeFactOrPattern(factString, ...fillerValues) {
    if (arguments.length === 0) {
      throw new Error('makeFactOrPattern requires at least one argument!');
    }
    if (typeof factString !== 'string') {
      throw new Error('factString must be a string!');
    }
    const fact = this.parse(factString);
    for (let idx = 0; idx < fact.terms.length; idx++) {
      const term = fact.terms[idx];
      if (term instanceof Hole) {
        if (fillerValues.length === 0) {
          throw new Error('not enough filler values!');
        }
        fact.terms[idx] = this.toTerm(fillerValues.shift());
      }
    }
    if (fillerValues.length > 0) {
      throw new Error('too many filler values!');
    }
    return fact;
  }

  parse(str, rule = 'factOrPattern') {
    if (rule !== 'factOrPattern') {
      return RoomDB.parse(str, rule);
    }
    let thing;
    if (this.parseCache.has(str)) {
      thing = this.parseCache.get(str);
    } else {
      thing = RoomDB.parse(str, rule);
      this.parseCache.set(str, thing);
    }
    return thing.clone();
  }

  clearParseCache() {
    this.parseCache.clear();
  }

  toTerm(x) {
    if (x instanceof Term) {
      return x;
    } else if (typeof x === 'boolean' ||
               typeof x === 'string' ||
               typeof x === 'number') {
      return new Val(x);
    } else {
      return new Blob(x);
    }
  }

  get facts() {
    return Array.from(this.factMap.values());
  }

  toString() {
    return this.facts.map(fact => fact.toString()).join('\n');
  }
}

class Client {
  constructor(id, db) {
    this.db = db;
    this.id = id;
  }

  select(...patterns) {
    return this.db.select(...patterns);
  }

  assert(factString, ...fillerValues) {
    return this.db.assert(this.id, factString, ...fillerValues);
  }

  retract(factString, ...fillerNames) {
    return this.db.retract(factString, ...fillerNames);
  }

  retractEverythingAbout(idString) {
    return this.db.retractEverythingAbout(idString);
  }

  retractEverythingAssertedByMe() {
    return this.db.retractEverythingAssertedBy(this.id);
  }

  get facts() {
    return this.db.facts;
  }

  disconnect() {
    this.db.clientMap.delete(this.id);
    this.db = null;  // to disable this client
  }

  toString() {
    return `[client ${this.id}]`;
  }
}

class Term {
  toRawValue() {
    return this;
  }
}

class Val extends Term {
  constructor(value) {
    super();
    this.value = value;
  }

  match(that, env) {
    return that instanceof Val && this.value === that.value ?
        env :
        null;
  }

  toRawValue() {
    return this.value;
  }

  toString() {
    return JSON.stringify(this.value);
  }
}

class Blob extends Term {
  constructor(value) {
    super();
    this.value = value;
  }

  match(that, env) {
    return that instanceof Blob && this.value === that.value ?
        env :
        null;
  }

  toRawValue() {
    return this.value;
  }

  toString() {
    return '@';
  }
}

class Var extends Term {
  constructor(name) {
    super();
    this.name = name;
  }

  match(that, env) {
    if (env[this.name] === undefined) {
      env[this.name] = that;
      return env;
    } else {
      return env[this.name].match(that, env);
    }
  }

  toRawValue() {
    throw new Error('vars should never show up in a solution!')
  }

  toString() {
    return '$' + this.name;
  }
}

class Hole extends Term {
  match(that, env) {
    throw new Error('holes should never show up in a query pattern');
  }

  toRawValue() {
    throw new Error('holes should never show up in a solution!')
  }

  toString() {
    return '_';
  }
}

class Id extends Term {
  constructor(name) {
    super();
    this.name = name;
  }

  match(that, env) {
    return that instanceof Id && this.name === that.name ?
        env :
        null;
  }

  toString() {
    return '#' + this.name;
  }
}

class Word extends Term {
  constructor(str) {
    super();
    this.str = str;
  }

  match(that, env) {
    return that instanceof Word && this.str === that.str ?
        env :
        null;
  }

  toString() {
    return this.str;
  }
}

class Fact {
  constructor(terms) {
    this.terms = terms;
  }

  hasVars() {
    return this.terms.some(term => term instanceof Var);
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

  clone() {
    return new Fact(this.terms.slice());
  }
}
