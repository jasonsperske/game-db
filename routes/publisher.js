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

  return router;
};
