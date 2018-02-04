'use strict';

import {Term, Variable, Wildcard} from './terms.js';

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

export default Fact
