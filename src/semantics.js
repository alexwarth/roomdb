 class Term {
   toRawValue () {
     return this
   }
}

 class Val extends Term {
   constructor (value) {
     super()
     this.value = value
   }

   match (that, env) {
     return that instanceof Val && this.value === that.value
        ? env
        : null
   }

   toRawValue () {
     return this.value
   }

   toString () {
     return JSON.stringify(this.value)
   }
}

 class Blob extends Term {
   constructor (value) {
     super()
     this.value = value
   }

   match (that, env) {
     return that instanceof Blob && this.value === that.value
        ? env
        : null
   }

   toRawValue () {
     return this.value
   }

   toString () {
     return '@'
   }
}

 class Var extends Term {
   constructor (name) {
     super()
     this.name = name
   }

   match (that, env) {
     if (env[this.name] === undefined) {
       env[this.name] = that
       return env
     } else {
       return env[this.name].match(that, env)
     }
   }

   toRawValue () {
     throw new Error('vars should never show up in a solution!')
   }

   toString () {
     return '$' + this.name
   }
}

 class Hole extends Term {
   match (that, env) {
     throw new Error('holes should never show up in a query pattern')
   }

   toRawValue () {
     throw new Error('holes should never show up in a solution!')
   }

   toString () {
     return '_'
   }
}

 class Id extends Term {
   constructor (name) {
     super()
     this.name = name
   }

   match (that, env) {
     return that instanceof Id && this.name === that.name
        ? env
        : null
   }

   toString () {
     return '#' + this.name
   }
}

 class Word extends Term {
   constructor (str) {
     super()
     this.str = str
   }

   match (that, env) {
     return that instanceof Word && this.str === that.str
        ? env
        : null
   }

   toString () {
     return this.str
   }
}

 class Fact {
   constructor (terms) {
     this.terms = terms
   }

   hasVars () {
     return this.terms.some(term => term instanceof Var)
   }

   match (that, env) {
     if (this.terms.length !== that.terms.length) {
       return null
     }
     for (let idx = 0; idx < this.terms.length; idx++) {
       const thisTerm = this.terms[idx]
       const thatTerm = that.terms[idx]
       if (!thisTerm.match(thatTerm, env)) {
         return null
       }
     }
     return env
   }

   toString () {
     return this.terms.map(term => term.toString()).join('')
   }

   clone () {
     return new Fact(this.terms.slice())
   }
}

 export { Fact, Word, Term, Blob, Val, Var, Hole, Id }
