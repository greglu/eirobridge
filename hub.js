var http = require('http');
var dnode = require('dnode');
var querystring = require('querystring');
var levelup = require('levelup');
var url = require('url');
var ecstatic = require('ecstatic')(__dirname + '/public');
var rc = require('rc')('eirobridge', {
  host: 'localhost',
  port: 8008
});

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
        res.end('Invalid URL. Subscription not added.');
      }
    });
  } else {
    subscribers.createKeyStream()
      .on('data', function (data) {
        console.log('key=', data)
      });

    return ecstatic(req, res);
  }
});

server.listen(8010);


function connect() {

  var req = http.request({
    hostname: rc.host,
    port: rc.port,
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
      broadcast: function(message, cb) {
        console.log(message);

        var parsedPayload = querystring.parse(message.payload);
        console.log('--- OUTPUTTING BROADCAST ---');
        console.log(parsedPayload);

        subscribers.createKeyStream()
          .on('data', function (subscriber) {
            var subscriberUrl = url.parse(subscriber);
            subscriberUrl.method = 'POST';
            subscriberUrl.headers = {
              'X-Forwarded-For': message.connection.remoteAddress
            };

            var req = http.request(subscriberUrl, function(res) {
              res.setEncoding('utf8');
            });

            req.on('error', function(e) {
              console.log('Subscriber (' + subscriber + ') error: ' + e.message);
            });

            req.write(message.payload);
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
