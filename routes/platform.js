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
    res.render('pages/platform/index', utils.read('platforms', 'index.json'));
  });

  router.get('/:company', (req, res) => {
    res.render('pages/platform/company/view', {
      company: utils.read(`platforms/${req.params.company}`, 'index.json')
    });
  });
  router.get('/:company/:platform', (req, res) => {
    res.render('pages/platform/company/platform/view', {
      company: utils.read(`platforms/${req.params.company}`, 'index.json'),
      platform: utils.read(`platforms/${req.params.company}/${req.params.platform}`, 'index.json')
    });
  });
  router.get('/:company/:platform/:region', (req, res) => {
    res.render('pages/platform/company/platform/region/view', {
      company: utils.read(`platforms/${req.params.company}`, 'index.json'),
      platform: utils.read(`platforms/${req.params.company}/${req.params.platform}`, 'index.json'),
      region: utils.read(`platforms/${req.params.company}/${req.params.platform}/${req.params.region}`, 'index.json'),
      releasedOn: utils.releasedOn
    });
  });
  router.route('/:company/:platform/:region/:game')
        .get((req, res) => {
          let game = utils.read(`platforms/${req.params.company}/${req.params.platform}/${req.params.region}/${req.params.game}`, 'index.json'),
              publishers = utils.read('publishers', 'index.json'),
              publisher = _.extend({guid: game.publisher, name: publishers[game.publisher].name}, utils.read(`publishers/${game.publisher}`, 'index.json')),
              developers = utils.read('developers', 'index.json'),
              game_developers = [];

          if(game.developers) {
            game.developers.forEach((developer) => {
              game_developers.push(_.extend({guid: developer}, developers[developer]));
            });
          }

          res.render('pages/platform/company/platform/region/game/view', {
            company: utils.read(`platforms/${req.params.company}`, 'index.json'),
            platform: utils.read(`platforms/${req.params.company}/${req.params.platform}`, 'index.json'),
            region: utils.read(`platforms/${req.params.company}/${req.params.platform}/${req.params.region}`, 'index.json'),
            game: game,
            publisher: publisher,
            developers: game_developers,
            releasedOn: utils.releasedOn
          });
        });

  return router;
};
