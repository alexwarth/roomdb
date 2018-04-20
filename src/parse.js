'use strict';

const ohm = require('ohm-js')

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

export default function parse(str, optRule) {
  const rule = optRule || 'factOrPattern';
  const matchResult = grammar.match(str.trim(), rule);
  if (matchResult.succeeded()) {
    return semantics(matchResult).parse();
  } else {
    throw new Error(`invalid ${rule}: ${str}`);
  }
};
