var http = require('http');
var dnode = require('dnode');
var querystring = require('querystring');
var levelup = require('levelup');
var url = require('url');

var subscribers = levelup('./subscribers');

var server_remote;


var server = http.createServer(function (req, res) {
  if (req.method == "POST") {
    var subscriber = "";

    req.on('data', function(chunk) {
      subscriber += chunk;
    });

    req.on("end", function() {
      var subscriberUrl = url.parse(subscriber);
      if (subscriberUrl.protocol && subscriberUrl.host && subscriberUrl.path) {
        subscribers.put(subscriber, 1);
        res.writeHead(201, {'Content-Type': 'text/plain'});
        res.end(subscriber + ' successfully added');
      } else {
        res.writeHead(406, {'Content-Type': 'text/plain'});
        res.end('Invalid URL. Subscription not added.');
      }
    });
  } else {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('eirobridge hub');

    subscribers.createKeyStream()
      .on('data', function (data) {
        console.log('key=', data)
      });
  }
});

server.listen(8010);


function connect() {

  var req = http.request({
    port: 8008,
    // hostname: 'www.heuheuheu.com',
    hostname: 'localhost',
    headers: {
      'Connection': 'Upgrade',
      'Upgrade': 'websocket'
    }
  });

  req.on('error', function(e) {
    console.log('Error connecting to server: ' + e.message + '. Reconnecting in 5 seconds...');
    setTimeout(connect, 5000);
  });

  req.end();

  req.on('upgrade', function(res, socket, upgradeHead) {
    var heartBeat;

    socket.setKeepAlive(true);
    socket.setTimeout(0);

    var d = dnode({
      broadcast: function(payload, cb) {
        var parsedPayload = querystring.parse(payload);
        console.log('--- OUTPUTTING BROADCAST ---');
        console.log(parsedPayload);

        subscribers.createKeyStream()
          .on('data', function (subscriber) {
            var subscriberUrl = url.parse(subscriber);
            subscriberUrl.method = 'POST';

            var req = http.request(subscriberUrl, function(res) {
              console.log('STATUS: ' + res.statusCode);
              console.log('HEADERS: ' + JSON.stringify(res.headers));
              res.setEncoding('utf8');
            });

            req.on('error', function(e) {
              console.log('Subscriber (' + subscriber + ') error: ' + e.message);
            });

            req.write(payload);
            req.end();
          });

        console.log('--- FINISHED BROADCAST ---');
      }
    });

    d.on('remote', function (remote) {
      server_remote = remote;
      heartBeat = setInterval(function() {
        server_remote.ping(function(s) {});
      }, 20000);
      console.log("%s : %s", req.connection.remoteAddress, "CONNECTED TO SERVER");
    });

    socket.pipe(d).pipe(socket);

    socket.on('timeout', function() {
      console.log('TIMED OUT');
    });

    socket.on('close', function() {
      console.log('CONNECTION CLOSED WITH SERVER. Reconnecting in 5 seconds...');
      if (heartBeat) {
        clearInterval(heartBeat);
      }
      setTimeout(connect, 5000);
    });

  });

};

connect();
