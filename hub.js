var http = require('http')
  , dnode = require('dnode')
  , querystring = require('querystring')
  , levelup = require('levelup')
  , url = require('url')
  , _ = require('underscore')
  , swig  = require('swig')

var indexTemplate = swig.compileFile(__dirname + '/templates/hub.html');
var rc = require('rc')('eirobridge', {
  port: 8010,
  bridge: 'http://localhost:8009',
  heartbeatPeriod: 45000,
  password: ''
});

// Append an http if none was provided
if (!rc.bridge.match(/^\s*(https*:\/\/.*)/)) {
  rc.bridge = 'http://' + rc.bridge;
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
        subscribers.get(subscriber, function(err) {
          if (err) {
            subscribers.put(subscriber, 1, function(putErr) {
              if (!putErr) {
                res.writeHead(201, {'Content-Type': 'text/plain'});
                res.end(subscriber + ' successfully added');
              } else {
                console.log("Error while adding subscriber (" + subscriber + "): " + putErr);
              }
            });
          } else {
            res.writeHead(303, {'Content-Type': 'text/plain'});
            res.end(subscriber + ' already exists');
          }
        });
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
        if ((req.headers['accept'] || req.headers['Accept']) == "application/json") {
          res.writeHead(200, {'Content-Type': 'application/json'});
          res.end(JSON.stringify(activeSubscribers));
        } else {
          res.writeHead(200, {'Content-Type': 'text/html'});
          res.end(indexTemplate.render({ eirobridge: rc.bridge, subscribers: activeSubscribers }));
        }
      });
  }
});

server.listen(rc.port);
console.log("Hub listening on port %s and connected to bridge: %s", rc.port, rc.bridge);


function connect() {

  var eirobridgeOptions = url.parse(rc.bridge);
  eirobridgeOptions.headers = {
      'Connection': 'Upgrade',
      'Upgrade': 'websocket'
    };

  if (rc.password) {
    eirobridgeOptions.headers['x-eirobridge-authentication'] = rc.password;
  }

  var req = http.request(eirobridgeOptions);

  req.on('error', function(e) {
    console.log('Error connecting to server: ' + e.message + '. Reconnecting in 5 seconds...');
    setTimeout(connect, 5000);
  });

  req.on('upgrade', function (res, socket, upgradeHead) {
    var heartBeat;

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
