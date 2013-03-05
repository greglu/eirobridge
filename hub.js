var http = require('http');
var dnode = require('dnode');
var querystring = require('querystring');
var levelup = require('levelup');
var url = require('url');
var _ = require('underscore');
var swig  = require('swig');

var indexTemplate = swig.compileFile(__dirname + '/templates/hub.html');
var rc = require('rc')('eirobridge', {
  url: 'http://localhost:8008',
  heartbeatPeriod: 45000
});

// Append an http if none was provided
if (!rc.url.match(/^\s*(https*:\/\/.*)/)) {
  rc.url = 'http://' + rc.url;
}

var subscribers = levelup('./subscribers');

var server_remote;


function extractSubscriber(bodyData) {
  if (!bodyData) { return null; }

  var parsedBodyData = querystring.parse(bodyData);
  var subscriber = !!(parsedBodyData.subscriber) ? parsedBodyData.subscriber : bodyData;
  var subscriberUrl = url.parse(subscriber);

  // Using url.parse to validate the input of subscriber from bodyData, but sending back
  // in unparsed form.
  if (subscriberUrl.protocol && subscriberUrl.host && subscriberUrl.path) {
    return subscriber;
  } else {
    return null;
  }
}

var server = http.createServer(function (req, res) {
  if (req.method == "POST") {
    var bodyData = "";

    req.on('data', function(chunk) {
      bodyData += chunk;
    });

    req.on("end", function() {
      var subscriber = extractSubscriber(bodyData);
      if (subscriber) {
        subscribers.put(subscriber, 1);
        res.writeHead(201, {'Content-Type': 'text/plain'});
        res.end(subscriber + ' successfully added');
      } else {
        res.writeHead(406, {'Content-Type': 'text/plain'});
        res.end('Invalid URL. Subscription not added.');
      }
    });
  } else if (req.method == "DELETE") {
    var bodyData = "";

    req.on('data', function(chunk) {
      bodyData += chunk;
    });

    req.on("end", function() {
      var subscriber = extractSubscriber(bodyData);
      if (subscriber) {
        subscribers.del(subscriber);
        res.writeHead(200, {'Content-Type': 'text/plain'});
        res.end(subscriber + ' successfully deleted');
      } else {
        res.writeHead(406, {'Content-Type': 'text/plain'});
        res.end('Invalid URL. Subscription was not remove.');
      }
    });
  } else {
    var activeSubscribers = [];

    subscribers.createKeyStream()
      .on('data', function (data) {
        activeSubscribers.push(data);
      })
      .on('end', function() {
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(indexTemplate.render({ eirobridge: rc.url, subscribers: activeSubscribers }));
      });
  }
});

server.listen(8010);


function connect() {

  var eirobridgeOptions = url.parse(rc.url);
  eirobridgeOptions.headers = {
      'Connection': 'Upgrade',
      'Upgrade': 'websocket'
    };

  var req = http.request(eirobridgeOptions);

  req.on('error', function(e) {
    console.log('Error connecting to server: ' + e.message + '. Reconnecting in 5 seconds...');
    setTimeout(connect, 5000);
  });

  req.on('upgrade', function (res, socket, upgradeHead) {
    var heartBeat;

    // socket.setKeepAlive(true);
    // socket.setTimeout(0);

    var d = dnode({
      PING : function (cb) {
        cb('PONG');
      },
      broadcast: function (message, cb) {
        console.log('--- MESSAGE RECEIVED FOR BROADCASTING ---');
        console.log(message);
        console.log('--- EO BROADCAST MESSAGE ---');

        subscribers.createKeyStream()
          .on('data', function (subscriber) {
            var subscriberOptions = url.parse(subscriber);
            subscriberOptions.method = 'POST';
            subscriberOptions.headers = subscriberOptions.headers || {};

            _.extend(subscriberOptions.headers,
              {
                'X-Forwarded-For': message.connection.remoteAddress
              },
              _.pick(message.headers, 'content-type', 'user-agent', 'x-forwarded-for', 'X-Forwarded-For'),
              {
                'Content-Length': message.payload.length
              }
            );

            console.log(subscriberOptions.headers);

            var req = http.request(subscriberOptions, function(res) {
              res.setEncoding('utf8');
            });

            req.on('error', function(e) {
              console.log('Subscriber (' + subscriber + ') error: ' + e.message);
            });

            req.end(message.payload);
          });
      }
    });

    d.on('remote', function (remote) {
      server_remote = remote;
      heartBeat = setInterval(function() {
        server_remote.PING(function(s) {});
      }, rc.heartbeatPeriod);
      console.log("%s : %s", req.connection.remoteAddress, "CONNECTED TO SERVER");
    });

    socket.pipe(d).pipe(socket);

    socket.on('timeout', function() {
      console.log('CONNECTION TO SERVER TIMED OUT');
    });

    socket.on('close', function() {
      console.log('CONNECTION CLOSED WITH SERVER. Reconnecting in 5 seconds...');
      if (heartBeat) {
        clearInterval(heartBeat);
      }
      setTimeout(connect, 5000);
    });

  });

  req.end();
};

connect();
