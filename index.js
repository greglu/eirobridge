var dnode = require('dnode');
var http = require('http');
var uuid = require('node-uuid');
var _ = require('underscore');

var rc = require('rc')('eirobridge', {
  port: 8008
});

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

      var broadcastMessage = {};
      broadcastMessage.payload = payload;
      broadcastMessage.headers = req.headers;
      broadcastMessage.connection = _.pick(req.connection, 'remoteAddress', 'remotePort');

      console.log('--- BROADCASTING MESSAGE ---');
      console.log(broadcastMessage);
      console.log('--- EO BROADCASTING MESSAGE ---');

      _.each(active_remotes, function (remote, id) {
        remote.broadcast(broadcastMessage);
        console.log('Broadcasted to: ' + id)
      });
    });
  } else {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end('<img src="http://i.imgur.com/uJMl9Lj.jpg" />');
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

server.listen(rc.port);
