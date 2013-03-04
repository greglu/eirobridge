var http = require('http');
var dnode = require('dnode');
var querystring = require('querystring');


var server_remote;

function connect() {

  var req = http.request({
    port: 8008,
    hostname: 'localhost',
    headers: {
      'Connection': 'Upgrade',
      'Upgrade': 'websocket'
    }
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
        server_remote.ping(function(s) {
          console.log(s);
        });
      }, 20000);
      console.log("%s : %s", req.connection.remoteAddress, "CONNECTED TO SERVER");
    });

    socket.pipe(d).pipe(socket);

    socket.on('timeout', function() {
      console.log('TIMED OUT');
    });

    socket.on('close', function() {
      console.log('CONNECTION CLOSED WITH SERVER');
      if (heartBeat) {
        clearInterval(heartBeat);
      }
      connect();
    });

  });

};

connect();
