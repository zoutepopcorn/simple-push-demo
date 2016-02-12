'use strict';

/* eslint-disable dot-notation */

var urlBase64 = require('urlsafe-base64');
var Firebase = require('firebase');
var fetch = require('node-fetch');

var EncryptionHelper = require('./encryption-helper');
var serverController = require('./server');
require('./dedupe-controller');

const GCM_USE_WEB_PUSH = false;
const GCM_ENDPOINT = 'https://android.googleapis.com/gcm/send';
const GCM_WEB_PUSH_ENDPOINT = 'https://jmt17.google.com/gcm/demo-webpush-00';
const GCM_AUTHORIZATION = 'AIzaSyBBh4ddPa96rQQNxqiq_qQj7sq1JdsNQUQ';

function handleGCMAPI(endpoint, encryptionHelper, encryptedDataBuffer) {
  var options = {
    uri: endpoint,
    method: 'POST',
    headers: {}
  };

  if (encryptionHelper !== null && encryptedDataBuffer !== null) {
    // Add required headers
    options.headers['Crypto-Key'] = 'dh=' +
      urlBase64.encode(encryptionHelper.getServerKeys().public);
    options.headers['Encryption'] = 'salt=' +
        urlBase64.encode(encryptionHelper.getSalt());
  }

  // Proprietary GCM
  var endpointParts = endpoint.split('/');
  var gcmRegistrationId = endpointParts[endpointParts.length - 1];

  if (GCM_USE_WEB_PUSH) {
    var webPushEndpoint = GCM_WEB_PUSH_ENDPOINT + '/' + gcmRegistrationId;
    return handleWebPushAPI(webPushEndpoint,
      encryptionHelper, encryptedDataBuffer);
  }

  var body = {
    'to': gcmRegistrationId
  };

  if (encryptedDataBuffer) {
    body['raw_data'] = encryptedDataBuffer.toString('base64');
  }

  // The registration ID cannot be included on the end of the GCM endpoint
  options.uri = GCM_ENDPOINT;
  options.headers['Content-Type'] = 'application/json';
  options.headers['Authorization'] = 'key=' + GCM_AUTHORIZATION;
  options.body = JSON.stringify(body);

  return request(options);
}

function handleWebPushAPI(endpoint, encryptionHelper, encryptedDataBuffer) {
  var options = {
    uri: endpoint,
    method: 'POST',
    headers: {}
  };

  // GCM web push NEEDS this
  if (endpoint.indexOf(GCM_WEB_PUSH_ENDPOINT) === 0) {
    options.headers['Authorization'] = 'key=' + GCM_AUTHORIZATION;
  } else {
    // GCM web push FAILS with this, but firefox NEEDS this
    options.headers['Content-Encoding'] = 'aesgcm128';
  }

  if (encryptionHelper !== null && encryptedDataBuffer !== null) {
    // Add required headers
    options.headers['Crypto-Key'] = 'dh=' +
      urlBase64.encode(encryptionHelper.getServerKeys().public);
    options.headers['Encryption'] = 'salt=' +
        urlBase64.encode(encryptionHelper.getSalt());
  }

  options.body = encryptedDataBuffer;

  return request(options);
}

function sendPushMessage(endpoint, keys) {
  let encryptionHelper = null;
  let encryptedDataBuffer = null;
  if (keys) {
    encryptionHelper = new EncryptionHelper({keys: keys});
    encryptedDataBuffer = encryptionHelper.encryptMessage('hello');
  }

  if (endpoint.indexOf('https://android.googleapis.com/gcm/send') === 0) {
    // Handle Proprietary GCM API
    return handleGCMAPI(endpoint, encryptionHelper, encryptedDataBuffer);
  }

  // Handle Web Push API
  return handleWebPushAPI(endpoint, encryptionHelper, encryptedDataBuffer);
}

serverController.expressApp.post('/register_web_push', function(req, res) {
  var endpoint = req.body.endpoint;
  // var keys = req.body.keys;
  if (!endpoint) {
    // If there is no endpoint we can't send anything
    return res.status(404).json({success: false});
  }

  var firebaseToken = endpoint.replace(/:|\/|\.|#|\[|\]|\$/g, '');

  var myFirebaseRef = new Firebase('https://dedupe.firebaseio.com/');
  var tokenRef = myFirebaseRef.child('web').child(firebaseToken);

  // TODO: Filter req.body
  tokenRef.child('details').set(req.body);
  tokenRef.child('paired').set(false);

  res.json({
    success: true,
    internalId: firebaseToken
  });
});

function sendPureAndroidNotifications(myFirebaseRef) {
  console.log('sendPureAndroidNotifications');
  return new Promise(function(resolve, reject) {
    var androidChildRef = myFirebaseRef.child('android');
    androidChildRef.once('value', function(dataSnapshot) {
      if (!dataSnapshot.exists()) {
        resolve();
        return;
      }

      var promises = [];
      try {
        var gcmIds = Object.keys(dataSnapshot.val());
        for (var i = 0; i < gcmIds.length; i++) {
          var gcmId = gcmIds[i];
          promises.push(
            fetch('https://android.googleapis.com/gcm/send', {
              method: 'post',
              headers: {
                'Authorization': 'key=' + GCM_AUTHORIZATION,
                'Content-type': 'application/json'
              },
              body: JSON.stringify({
                to: gcmId
              })
            })
            .then(function(response) {
              return response.json();
            })
            .then(function(response) {
              if (response.failure != 0) {
                console.log(response);
                console.log('Maybe remove from firebase?');
                console.log('');
              }
            })
            .catch(function(err) {
              console.log(err);
            })
          );
        }
      } catch (err) {
        console.log('sendPureAndroidNotifications()', err);
      }

      Promise.all(promises)
      .then(resolve, reject);
    });
  });
}

function sendWebNotifications(myFirebaseRef) {
  console.log('sendWebNotifications');
  return new Promise(function(resolve, reject) {
    var duplicationsRef = myFirebaseRef.child('duplications');
    var webChildRef = myFirebaseRef.child('web');
    webChildRef.once('value', function(dataSnapshot) {
      if (!dataSnapshot.exists()) {
        resolve();
        return;
      }

      var promises = [];
      try {
        var webData = dataSnapshot.val();
        var webIds = Object.keys(webData);
        for (var i = 0; i < webIds.length; i++) {
          var webId = webIds[i];

          promises.push(new Promise(function(resolve, reject) {
            duplicationsRef.child(webId).once('value', function(snapshot) {
              if (snapshot.exists()) {
                // There is a duplication - do nothing
                resolve();
                return;
              }

              var webSubscription = webData[webId].details;
              var endpoint = webSubscription.endpoint;

              var parts = endpoint.split('/');
              var gcmId = parts[parts.length - 1];

              fetch(GCM_ENDPOINT, {
                method: 'post',
                headers: {
                  'Authorization': 'key=' + GCM_AUTHORIZATION,
                  'Content-type': 'application/json'
                },
                body: JSON.stringify({
                  to: gcmId
                })
              })
              .then(function(response) {
                return response.text();
              })
              .then(function(response) {
                console.log(response);
                console.log('');
                resolve();
              })
              .catch(function(err) {
                console.log(err);
                reject();
              });
            });
          }));
        }
      } catch (err) {
        console.log('sendPureAndroidNotifications()', err);
      }

      Promise.all(promises)
      .then(resolve, reject);
    });
  });
}

serverController.expressApp.post('/admin_trigger_push', function(req, res) {
  var myFirebaseRef = new Firebase('https://dedupe.firebaseio.com/');

  sendPureAndroidNotifications(myFirebaseRef)
  .then(function() {
    return sendWebNotifications(myFirebaseRef);
  });

  res.json({success: true});
});
