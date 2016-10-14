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
          publisher = _.extend({guid:req.params.publisher}, publishers[req.params.publisher], utils.readJSON('publishers/'+req.params.publisher, 'index.json'));
    let games = {};

    publisher.platforms.forEach((platform) => {
      var platfrom_games = utils.readJSON('platforms/'+platform, 'games.json');
      Object.keys(platfrom_games).forEach((game) => {
        if(platfrom_games[game].publisher === publisher.guid) {
          games[platform+'/'+game] = platfrom_games[game];
        }
      });
    });

    res.render('pages/publisher/view', {
      publisher: publisher,
      games: games
    });
  });

  return router;
};
