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

(function() {
  var sendPushButton = document.querySelector('.js-send-push-button');
  sendPushButton.addEventListener('click', function() {
    console.log('Send push Message');
    sendPushButton.disabled = true;

    fetch('/admin_trigger_push', {
      method: 'POST'
    })
    .then(function(response) {
      console.log('Finished');
      sendPushButton.disabled = false;
    });
  });
})();
