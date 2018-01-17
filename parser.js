'use strict';

RoomDB.grammar = ohm.grammar(`
  G {

    factOrPattern
      = term*

    term
      = keyword<"true">   -- true
      | keyword<"false">  -- false
      | keyword<"null">   -- null
      | space+            -- spaces
      | var
      | hole
      | identity
      | number
      | string
      | word

    keyword<k>
      = k ~alnum

    var
      = "$" alnum*

    hole
      = "_"

    identity
      = "#" alnum*

    number
      = float ("e" float)?

    float
      = integer ("." digit+)?

    integer
      = ("+" | "-")? digit+

    string
      = "\\"" (~"\\"" ~"\\n" any)* "\\""

    word
      = (~special any)+

    special
      = var | hole | identity | number | space

  }
`);

RoomDB.semantics = RoomDB.grammar.createSemantics().addOperation('parse', {
  factOrPattern(terms) {
    return new Fact(terms.parse());
  },
  term_true(_) {
    return new Val(true);
  },
  term_false(_) {
    return new Val(false);
  },
  term_null(_) {
    return new Val(null);
  },
  var(_, cs) {
    return new Var(cs.sourceString);
  },
  hole(_) {
    return new Hole();
  },
  identity(_, cs) {
    return new Id(cs.sourceString);
  },
  number(_1, _2, _3) {
    return new Val(parseFloat(this.sourceString));
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
    return new Val(chars.join(''));
  },
  word(_) {
    return new Word(this.sourceString);
  },
  term_spaces(_) {
    return new Word(' ');
  },
  _terminal() {
    return this.sourceString;
  }
});

RoomDB.parse = function(str, rule) {
  const matchResult = RoomDB.grammar.match(str.trim(), rule);
  if (matchResult.succeeded()) {
    return RoomDB.semantics(matchResult).parse();
  } else {
    throw new Error(`invalid ${rule}: ${str}`);
  }
};
