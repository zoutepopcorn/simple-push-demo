'use strict';

var serverController = require('./server');
var Preferences = require('./preferences');

var devicePreferences = new Preferences('./device-preferences.json');
var deviceIDCounter = 0;
var devices = [];

devicePreferences.get('deviceIDCounter')
.then(value => {
  if (value !== null) {
    deviceIDCounter = value;
  }
  return devicePreferences.get('devices');
})
.then(storedDevices => {
  if (storedDevices !== null) {
    devices = storedDevices;
  }
})
.then(registerEndpoints);

function registerEndpoints() {
  serverController.expressApp.post('/dedupe/register-gcm-id/:registrationtype/',
    function(req, res) {
      var endpoint = req.body.endpoint;
      if (!endpoint) {
        // If there is no endpoint we can't send anything
        return res.status(404).json({success: false});
      }

      var endpointSplit = endpoint.split('/');
      var registrationId = endpointSplit[endpointSplit.length - 1];

      var existing = devices.filter(device => {
        if (device.regId === registrationId) {
          return device;
        }
      });

      if (existing.length > 0) {
        return res.json({success: true});
      }

      devices.push({
        regId: registrationId,
        id: deviceIDCounter,
        type: req.params.registrationtype
      });

      devicePreferences.set('devices', devices)
      .then(() => {
        deviceIDCounter++;
        devicePreferences.set('deviceIDCounter', deviceIDCounter);
      })
      .then(() => {
        res.json({success: true});
      });
    }
  );
}
