"use strict";
const express = require('express'),
      cms = express(),
      urlencodedParser = require('body-parser').urlencoded({
        extended: true
      }),
      env = require('node-env-file'),
      ejs = require('ejs'),
      fs = require('fs'),
      path = require('path'),
      mkdirp = require('mkdirp'),
      utils = {
        readJSON: (base, module) => {
          try {
            fs.accessSync(path.join(__dirname, 'content', base, module), fs.R_OK | fs.W_OK);
            delete require.cache[require.resolve('./content/'+base+'/'+module)];
            return require('./content/'+base+'/'+module);
          } catch(e) {
            console.log(e);
            return {};
          }
        },
        saveJSON: (base, filename, data, then) => {
          mkdirp(path.join(__dirname, './content/', base), (err) => {
            if (err) {
              console.error(err);
            } else {
              fs.writeFile(path.join(__dirname, './content/', base, '/', filename), JSON.stringify(data, null, 2), then);
            }
          });
        }
      };

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

cms.use('/publisher', require('./routes/publisher')(utils));

cms.listen(process.env.PORT, process.env.IP, () => {
  console.log('Listening for cms requests at http://'+process.env.IP+':'+process.env.PORT+'/');
});
