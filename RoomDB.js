'use strict';

// TODO: think about primary keys

class RoomDB {
  constructor() {
    this.parseCache = new Map();
    this.factMap = new Map();
    this.evidenceStack = [];
  }

  query(patternOrPatterns, optCallbackFn) {
    let patterns;
    if (typeof patternOrPatterns === 'string') {
      patterns = [patternOrPatterns];
    } else {
      patterns = patternOrPatterns;
    }
    patterns = patterns.map(pattern => this.parse(pattern));
    const solutions = [];
    this.collectSolutions(patterns, Object.create(null), solutions);
    if (optCallbackFn) {
      for (let solution of solutions) {
        for (let name in solution) {
          solution[name] = solution[name].toRawValue();
        }
        optCallbackFn(solution);
      }
    }
    return solutions.length > 0;
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

  assert(factString, ...fillerValues) {
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
    fact.evidence = this.evidenceStack.length > 0 ?
        this.evidenceStack[this.evidenceStack.length - 1] :
        [];
    this.factMap.set(fact.toString(), fact);
    return {
      withEvidence(...evidence) {
        fact.evidence = evidence;
      },
      withoutEvidence() {
        fact.evidence = [];
      }
    };
  }

  retract(factString) {
    const factOrPattern = this.parse(factString, 'fact');
    if (factOrPattern.hasVarsOrHoles()) {
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

  forgetEverythingAbout(idString) {
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
    // Holes act as wildcards when used in query patterns
    return env;
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

  hasVarsOrHoles() {
    return this.terms.some(term =>
        term instanceof Var ||
        term instanceof Hole);
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
