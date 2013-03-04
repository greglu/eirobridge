var dnode = require('dnode');
var http = require('http');
var uuid = require('node-uuid');
var _ = require('underscore');

var active_remotes = {};

var server = http.createServer(function (req, res) {
  if (req.method == "POST") {
    var payload = "";

    req.on('data', function(chunk) {
      payload += chunk;
    });

    req.on("end", function() {
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('posted');

      console.log('--- BROADCASTING PAYLOAD ---');
      console.log(payload);
      console.log('--- FINISHED BROADCASTING ---');

      _.each(active_remotes, function (remote) {
        remote.broadcast(payload);
      });
    });
  } else {
    res.writeHead(200, {'Content-Type': 'text/plain'});
    res.end('okay');
  }
});

server.on('upgrade', function(req, socket, head) {
  // var id = uuid.v4();
  var id = req.connection.remoteAddress;

  socket.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n' +
               'Upgrade: WebSocket\r\n' +
               'Connection: Upgrade\r\n' +
               '\r\n');


  var d = dnode({
    ping : function(cb) {
      cb('pong');
    }
  });

  d.on('remote', function (remote) {
    active_remotes[id] = remote;
    console.log("%s : %s", id, "CONNECTED");
  });

  socket.pipe(d).pipe(socket);

  socket.on('close', function() {
    delete active_remotes[id];
    console.log("%s : %s", id, "DISCONNECTED");
  });
});

server.listen(8008);
