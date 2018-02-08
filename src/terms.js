'use strict';

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

export {
  Term,
  Id,
  Word,
  Value,
  BlobRef,
  Variable,
  Wildcard,
  Hole
}
