'use strict';

/**
 *
 *  Web Starter Kit
 *  Copyright 2014 Google Inc. All rights reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *    https://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License
 *
 */

import PushClient from './push-client.js';

function updateUIForPush(pushToggleSwitch) {
  var stateChangeListener = function(state, data) {
    // console.log(state);
    if (typeof(state.interactive) !== 'undefined') {
      if (state.interactive) {
        pushToggleSwitch.enable();
      } else {
        pushToggleSwitch.disable();
      }
    }

    if (typeof(state.pushEnabled) !== 'undefined') {
      if (state.pushEnabled) {
        pushToggleSwitch.on();
      } else {
        pushToggleSwitch.off();
      }
    }

    switch (state.id) {
    case 'ERROR':
      console.error(data);
      showErrorMessage(
        'Ooops a Problem Occurred',
        data
      );
      break;
    default:
      break;
    }
  };

  var subscriptionUpdate = (subscription) => {
    console.log('subscriptionUpdate: ', subscription);
    var sendPushOptions = document.querySelector('.js-send-push-options');
    if (!subscription) {
      // Remove any subscription from your servers if you have
      // set it up.
      sendPushOptions.style.opacity = 0;
      return;
    }

    var isChromeForAndroid = function() {
      var regex = /.*Android \d+\.\d+(\.\d+)?;.*Chrome\/\d+\.\d+\.\d+\.\d+.*/g;
      return (regex.exec(navigator.userAgent) !== null);
    };

    // Register new subscription
    fetch('/register_web_push', {
      method: 'post',
      headers: {
        'Content-type': 'application/json'
      },
      body: JSON.stringify(subscription)
    })
    .then(function(response) {
      return response.json();
    })
    .then(function(responseObj) {
      if (!responseObj.success) {
        return;
      }

      var internalId = responseObj.internalId;

      var intenLink = document.querySelector('.js-intent-button');
      if (subscription.endpoint.indexOf(
        'https://android.googleapis.com/gcm/send') === 0) {
        if (isChromeForAndroid()) {
          var appPackage = 'com.gauntface.push.dedupe';
          var fallbackUrl = encodeURIComponent(
            window.location.origin +
            window.location.pathname +
            '?dedupeCheck=true'
          );
          var appIntent = `intent:#Intent;package=${appPackage};` +
              `S.browser_fallback_url=${fallbackUrl};` +
              `type=text/plain;S.com.gauntface.push.` +
              `dedupe.intent.extra.WEB_PUSH_ID` +
              `=${internalId};end`;

          // This is blocked by Chrome
          // window.location = appIntent;

          intenLink.style.display = 'inline-block';
          intenLink.href = appIntent;
        } else {
          intenLink.style.display = 'none';
        }
      } else {
        intenLink.style.display = 'none';
      }

      sendPushOptions.style.opacity = 1;
    });
  };

  var pushClient = new PushClient(
    stateChangeListener,
    subscriptionUpdate
  );

  document.querySelector('.js-push-toggle-switch > input')
  .addEventListener('click', function(event) {
    // Inverted because clicking will change the checked state by
    // the time we get here
    if (!event.target.checked) {
      pushClient.unsubscribeDevice();
    } else {
      pushClient.subscribeDevice();
    }
  });

  // Check that service workers are supported
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js', {
      scope: './'
    });
  } else {
    showErrorMessage(
      'Service Worker Not Supported',
      'Sorry this demo requires service worker support in your browser. ' +
      'Please try this demo in Chrome or Firefox Nightly.'
    );
  }
}


// Below this comment is code to initialise a material design lite view.
var toggleSwitch = document.querySelector('.js-push-toggle-switch');
toggleSwitch.initialised = false;

// This is to wait for MDL initialising
document.addEventListener('mdl-componentupgraded', function() {
  if (toggleSwitch.initialised) {
    return;
  }

  toggleSwitch.initialised = toggleSwitch.classList.contains('is-upgraded');
  if (!toggleSwitch.initialised) {
    return;
  }

  var pushToggleSwitch = toggleSwitch.MaterialSwitch;

  updateUIForPush(pushToggleSwitch);
});

function showErrorMessage(title, message) {
  var errorContainer = document.querySelector('.js-error-message-container');

  var titleElement = errorContainer.querySelector('.js-error-title');
  var messageElement = errorContainer.querySelector('.js-error-message');
  titleElement.textContent = title;
  messageElement.textContent = message;
  errorContainer.style.opacity = 1;

  var pushOptionsContainer = document.querySelector('.js-send-push-options');
  pushOptionsContainer.style.display = 'none';
}
