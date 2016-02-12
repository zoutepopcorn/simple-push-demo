'use strict'

var express = require('express');
var bodyParser = require('body-parser');

class ServerController {
  constructor() {
    this._expressApp = express();
    this._expressApp.use(bodyParser.urlencoded({extended: true}));
    this._expressApp.use(bodyParser.json());

    this._expressApp.use('/', express.static('./dist'));

    var server = this._expressApp.listen(3000, () => {
      var port = server.address().port;
      console.log('Server is listening at http://localhost:%s', port);
    });
  }

  get expressApp() {
    return this._expressApp;
  }
}

module.exports = new ServerController();
