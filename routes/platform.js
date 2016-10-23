"use strict";
module.exports = (utils) => {
  const router = new require('express').Router(),
        ejs = require('ejs'),
        fs = require('fs'),
        _ = require('underscore'),
        urlencodedParser = require('body-parser').urlencoded({
          extended: true
        });

  const render_platform = (res, company, platform, region) => {
    res.render('pages/platform/index', {
      company: utils.readJSON(`platforms/${company}`, 'index.json'),
      platform: platform ? utils.readJSON(`platforms/${company}/${platform}`, 'index.json') : undefined,
      region: region ? utils.readJSON(`platforms/${company}/${platform}/${region}`, 'index.json') : undefined
    });
  };

  router.get('/', (req, res) => {
    res.render('pages/platform/index', utils.readJSON('platforms', 'index.json'));
  });
  router.get('/:company', (req, res) => {
    render_platform(res, req.params.company);
  });
  router.get('/:company/:platform', (req, res) => {
    render_platform(res, req.params.company, req.params.platform);
  });
  router.get('/:company/:platform/:region', (req, res) => {
    render_platform(res, req.params.company, req.params.platform, req.params.region);
  });
  router.get('/:company/:platform/:region/:game', (req, res) => {
    res.render('pages/platform/view', {
      company: utils.readJSON(`platforms/${req.params.company}`, 'index.json'),
      platform: utils.readJSON(`platforms/${req.params.company}/${req.params.platform}`, 'index.json'),
      region: utils.readJSON(`platforms/${req.params.company}/${req.params.platform}/${req.params.region}`, 'index.json'),
      game: utils.readJSON(`platforms/${req.params.company}/${req.params.platform}/${req.params.region}/${req.params.game}`, 'index.json')
    });
  });


  return router;
};
