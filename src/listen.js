'use strict';

const restify = require('restify');
const errors = require('restify-errors');
const corsMiddleware = require('restify-cors-middleware');

function listen(port = 8080) {
  const db = this;
  const server = restify.createServer({name: 'RoomDB'});
  server.use(restify.plugins.queryParser());

  const cors = corsMiddleware({origins: ['*']});
  server.pre(cors.preflight);
  server.use(cors.actual);

  server.get('/facts', (req, res, next) => {
    try {
      const patterns = JSON.parse(req.query.query);
      const solutions = db.select(...patterns);
      res.send(solutions);
      next();
    } catch (e) {
      console.error('uh-oh:', e);
      next(e instanceof SyntaxError ?
          new errors.BadRequestError(e.message) :
          new errors.InternalServerError(e.message));
    }
  });

  server.put('/facts', (req, res, next) => {
    try {
      const retractions = req.query.retractions !== undefined ?
          JSON.parse(req.query.retractions) :
          [];
      const assertions = req.query.assertions !== undefined ?
          JSON.parse(req.query.assertions) :
          [];
      retractions.forEach(pattern => db.retract(req.query.clientId, pattern));
      assertions.forEach(fact => db.assert(req.query.clientId, fact));
      res.send('ok');
      next();
    } catch (e) {
      next(e instanceof SyntaxError ?
          new errors.BadRequestError(e.message) :
          new errors.InternalServerError(e.message));
    }
  });

  server.del('/facts', (req, res, next) => {
    if (req.query.name !== undefined) {
      db.retractEverythingAbout(req.query.clientId, req.query.name);
    } else {
      db.retractEverythingAssertedBy(req.query.clientId);
    }
    res.send('ok');
    next();
  });

  server.listen(port, () => {
    console.log('%s listening at %s', server.name, server.url);
  });

  return db;
}

module.exports = listen;
