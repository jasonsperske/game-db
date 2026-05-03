'use strict';

const express = require('express');

module.exports = (utils) => {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.render('pages/publisher/index', {
      publishers: utils.read('publishers', 'index.json')
    });
  });

  router.get('/:publisher', (req, res) => {
    const publishers = utils.read('publishers', 'index.json');
    const publisher = {
      guid: req.params.publisher,
      ...publishers[req.params.publisher],
      ...utils.read(`publishers/${req.params.publisher}`, 'index.json')
    };
    const games = {};

    (publisher.platforms || []).forEach((platform) => {
      const platformGames = utils.read(`platforms/${platform}`, 'index.json').games || {};
      Object.keys(platformGames).forEach((game) => {
        if (platformGames[game].publisher === publisher.guid) {
          games[`${platform}/${game}`] = { platform, ...platformGames[game] };
        }
      });
    });

    res.render('pages/publisher/view', {
      publisher,
      games,
      releasedOn: utils.releasedOn
    });
  });

  return router;
};
