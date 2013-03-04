var http = require('http');
var dnode = require('dnode');
var querystring = require('querystring');


var server_remote;

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
