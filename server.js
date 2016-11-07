"use strict";
const express = require('express'),
      cms = express(),
      urlencodedParser = require('body-parser').urlencoded({
        extended: true
      }),
      env = require('node-env-file'),
      fs = require('fs'),
      ejs = require('ejs'),
      utils = require('./fileCMS-utils')(__dirname);

try {
    fs.accessSync(__dirname + '/.env', fs.F_OK);
    env(__dirname + '/.env');
} catch (e) {}

cms.set('view engine', 'html');
cms.engine('html', ejs.renderFile);
cms.locals.layout = 'layout';
cms.locals.delimiter = ':';

cms.use('/static', express.static('static'));
cms.use("/content", express.static('content'));
cms.use(require('express-ejs-layouts'));

cms.get('/', (req, res) => {
  res.render('pages/index');
});

cms.use('/platform', require('./routes/platform')(utils));
cms.use('/publisher', require('./routes/publisher')(utils));

cms.listen(process.env.PORT, process.env.IP, () => {
  console.log('Listening for cms requests at http://'+process.env.IP+':'+process.env.PORT+'/');
});
