// Imports
var express = require('express');
var path = require('path');
var logger = require('morgan');
var bodyParser = require('body-parser');
var routes = require('./server/routes');
var app = express();

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// Set up REST endpoints
app.use('/', routes);

// Fallback to the home page on unknown requests
app.use(function(err, req, res, next) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;