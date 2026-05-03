'use strict';

require('dotenv').config({ path: __dirname + '/.env', quiet: true });

const express = require('express');
const ejs = require('ejs');
const expressLayouts = require('express-ejs-layouts');
const utils = require('./fileCMS-utils')(__dirname);

const app = express();
const port = process.env.PORT || 3000;
const host = process.env.IP || '0.0.0.0';
const baseUrl = (process.env.BASE_URL || '').replace(/\/$/, '');
const editMode = process.env.NODE_ENV === 'development';

app.set('view engine', 'html');
app.engine('html', ejs.renderFile);
app.locals.layout = 'layout';
app.locals.delimiter = ':';
app.locals.baseUrl = baseUrl;
app.locals.editMode = editMode;

app.use(express.urlencoded({ extended: false }));

app.use(`${baseUrl}/static`, express.static('static'));
app.use(`${baseUrl}/content`, express.static('content'));
app.use(expressLayouts);

app.get(`${baseUrl}/humans.txt`, (req, res) => {
  res.type('text/plain').sendFile('humans.txt', { root: __dirname });
});

app.get(`${baseUrl}/`, (req, res) => {
  res.render('pages/index');
});

app.use(`${baseUrl}/platform`, require('./routes/platform')(utils, { editMode }));
app.use(`${baseUrl}/publisher`, require('./routes/publisher')(utils));

app.listen(port, host, () => {
  console.log(`Listening for cms requests at http://${host}:${port}/`);
});
