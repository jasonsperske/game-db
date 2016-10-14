"use strict";
module.exports = (utils) => {
  const router = new require('express').Router(),
        ejs = require('ejs'),
        fs = require('fs'),
        _ = require('underscore'),
        urlencodedParser = require('body-parser').urlencoded({
          extended: true
        });

  router.get('/', (req, res) => {
    res.render('pages/publisher/index', {
      publishers: utils.readJSON('publishers', 'index.json')
    });
  });
  router.get('/:publisher', (req, res) => {
    const publishers = utils.readJSON('publishers', 'index.json'),
          publisher = publishers[req.params.publisher];
    res.render('pages/publisher/view', {
      publisher: publisher
    });
  });

  return router;
};
