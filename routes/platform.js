"use strict";
module.exports = (utils) => {
  const router = new require('express').Router(),
        ejs = require('ejs'),
        fs = require('fs'),
        _ = require('underscore'),
        moment = require('moment'),
        urlencodedParser = require('body-parser').urlencoded({
          extended: true
        });

  router.get('/', (req, res) => {
    res.render('pages/platform/index', utils.readJSON('platforms', 'index.json'));
  });

  router.get('/:company', (req, res) => {
    res.render('pages/platform/company/view', {
      company: utils.readJSON(`platforms/${req.params.company}`, 'index.json')
    });
  });
  router.get('/:company/:platform', (req, res) => {
    res.render('pages/platform/company/platform/view', {
      company: utils.readJSON(`platforms/${req.params.company}`, 'index.json'),
      platform: utils.readJSON(`platforms/${req.params.company}/${req.params.platform}`, 'index.json')
    });
  });
  router.get('/:company/:platform/:region', (req, res) => {
    res.render('pages/platform/company/platform/region/view', {
      company: utils.readJSON(`platforms/${req.params.company}`, 'index.json'),
      platform: utils.readJSON(`platforms/${req.params.company}/${req.params.platform}`, 'index.json'),
      region: utils.readJSON(`platforms/${req.params.company}/${req.params.platform}/${req.params.region}`, 'index.json'),
      releasedOn: (game) => {
        if(game.released.year && game.released.month && game.released.day) {
          return moment([game.released.year, game.released.month-1, game.released.day]).format('MMM Do YYYY');
        } else if(game.released.year && game.released.month) {
          return moment([game.released.year, game.released.month-1, 1]).format('MMM YYYY');
        } else if(game.released.year) {
          return game.released.year;
        } else {
          return '-?-';
        }
      }
    });
  });
  router.get('/:company/:platform/:region/:game', (req, res) => {
    res.render('pages/platform/company/platform/region/game/view', {
      company: utils.readJSON(`platforms/${req.params.company}`, 'index.json'),
      platform: utils.readJSON(`platforms/${req.params.company}/${req.params.platform}`, 'index.json'),
      region: utils.readJSON(`platforms/${req.params.company}/${req.params.platform}/${req.params.region}`, 'index.json'),
      game: utils.readJSON(`platforms/${req.params.company}/${req.params.platform}/${req.params.region}/${req.params.game}`, 'index.json')
    });
  });


  return router;
};
