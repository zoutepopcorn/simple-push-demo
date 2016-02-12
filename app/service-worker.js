'use strict';

function showNotification(title, body, icon, data) {
  // Firefox has an issue with showing a notification with the icon from
  // the Yaho API
  // (i.e. http://l.yimg.com/a/i/brand/purplelogo//uh/us/news-wea.gif)
  // HTTP, CORs or Size issue.
  var notificationOptions = {
    body: body,
    icon: icon ? icon : '/images/touch/chrome-touch-icon-192x192.png',
    tag: 'simple-push-demo-notification',
    data: data
  };
  return self.registration.showNotification(title, notificationOptions);
}

self.addEventListener('push', function(event) {
  console.log('Received a push message');

  if (event.data) {
    var output = event.data.text();
    console.log(output);
  }

  var url = 'https://gauntface.com/blog';
  if (isChromeForAndroid()) {
    var appPackage = 'com.gauntface.push.dedupe';
    var fallbackUrl = encodeURIComponent(url);
    url = `intent:#Intent;package=${appPackage};` +
        `S.browser_fallback_url=${fallbackUrl};` +
        `type=text/plain;end`;
  }

  console.log('Opening: ' + url);

  // Since this is no payload data with the first version
  // of Push notifications, here we'll grab some data from
  // an API and use it to populate a notification
  event.waitUntil(
    showNotification(
      'Web App Notification - Push DeDupe',
      '',
      null,
      {
        url: url
      }
      )
  );
});

var isChromeForAndroid = function() {
  var regex = /.*Android \d+\.\d+(\.\d+)?;.*Chrome\/\d+\.\d+\.\d+\.\d+.*/g;
  return (regex.exec(navigator.userAgent) !== null);
};

self.addEventListener('notificationclick', function(event) {
  var url = event.notification.data.url;

  event.notification.close();
  event.waitUntil(clients.openWindow(url));
});
