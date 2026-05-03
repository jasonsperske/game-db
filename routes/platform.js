'use strict';

const express = require('express');

const padTwo = (n) => String(n).padStart(2, '0');

const parseReleased = ({ year, month, day }) => {
  const released = {};
  const y = parseInt(year, 10);
  const m = parseInt(month, 10);
  const d = parseInt(day, 10);
  if (Number.isFinite(y)) released.year = y;
  if (Number.isFinite(m)) released.month = m;
  if (Number.isFinite(d)) released.day = d;
  if (released.year) {
    released.sortable = `${released.year}-${padTwo(released.month || 1)}-${padTwo(released.day || 1)}`;
  }
  return released;
};

const parseDevelopers = (raw) =>
  (raw || '')
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

module.exports = (utils, { editMode = false } = {}) => {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.render('pages/platform/index', utils.read('platforms', 'index.json'));
  });

  router.get('/:company', (req, res) => {
    res.render('pages/platform/company/view', {
      company: utils.read(`platforms/${req.params.company}`, 'index.json')
    });
  });

  router.get('/:company/:platform', (req, res) => {
    const { company, platform } = req.params;
    res.render('pages/platform/company/platform/view', {
      company: utils.read(`platforms/${company}`, 'index.json'),
      platform: utils.read(`platforms/${company}/${platform}`, 'index.json')
    });
  });

  router.get('/:company/:platform/:region', (req, res) => {
    const { company, platform, region } = req.params;
    res.render('pages/platform/company/platform/region/view', {
      company: utils.read(`platforms/${company}`, 'index.json'),
      platform: utils.read(`platforms/${company}/${platform}`, 'index.json'),
      region: utils.read(`platforms/${company}/${platform}/${region}`, 'index.json'),
      releasedOn: utils.releasedOn
    });
  });

  const renderGame = (req, res, template) => {
    const { company, platform, region, game: gameId } = req.params;
    const game = utils.read(`platforms/${company}/${platform}/${region}/${gameId}`, 'index.json');
    const publishers = utils.read('publishers', 'index.json');
    const publisherMeta = publishers[game.publisher] || {};
    const publisher = {
      guid: game.publisher,
      name: publisherMeta.name,
      ...utils.read(`publishers/${game.publisher}`, 'index.json')
    };
    const developersIndex = utils.read('developers', 'index.json');
    const gameDevelopers = (game.developers || []).map((developer) => ({
      guid: developer,
      ...developersIndex[developer]
    }));

    res.render(template, {
      company: utils.read(`platforms/${company}`, 'index.json'),
      platform: utils.read(`platforms/${company}/${platform}`, 'index.json'),
      region: utils.read(`platforms/${company}/${platform}/${region}`, 'index.json'),
      game,
      publisher,
      developers: gameDevelopers,
      releasedOn: utils.releasedOn
    });
  };

  router.get('/:company/:platform/:region/:game', (req, res) => {
    renderGame(req, res, 'pages/platform/company/platform/region/game/view');
  });

  if (editMode) {
    router.get('/:company/:platform/:region/:game/edit', (req, res) => {
      renderGame(req, res, 'pages/platform/company/platform/region/game/edit');
    });

    router.post('/:company/:platform/:region/:game', (req, res) => {
      const { company, platform, region, game: guid } = req.params;
      const { name, publisher, year, month, day, developers } = req.body;

      const record = { guid, name: (name || '').trim() || guid };
      const trimmedPublisher = (publisher || '').trim();
      if (trimmedPublisher) record.publisher = trimmedPublisher;

      const released = parseReleased({ year, month, day });
      if (released.year) record.released = released;

      const devList = parseDevelopers(developers);
      if (devList.length) record.developers = devList;

      utils.save(`platforms/${company}/${platform}/${region}/${guid}`, 'index.json', record);

      const regionData = utils.read(`platforms/${company}/${platform}/${region}`, 'index.json');
      regionData.games = regionData.games || {};
      const { guid: _ignored, ...mapEntry } = record;
      regionData.games[guid] = mapEntry;
      utils.save(`platforms/${company}/${platform}/${region}`, 'index.json', regionData);

      res.redirect(`${req.baseUrl}/${company}/${platform}/${region}/${guid}`);
    });
  }

  return router;
};
