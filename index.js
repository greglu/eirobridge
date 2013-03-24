var dnode = require('dnode')
  , http = require('http')
  , uuid = require('node-uuid')
  , _ = require('underscore');

var rc = require('rc')('eirobridge', {
  port: 8009,
  password: ''
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
  var id = req.headers['X-Forwarded-For'] || req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  var d = dnode({
    PING : function(cb) {
      cb('PONG');
    }
  });

  d.on('remote', function (remote) {

    if (rc.password) {
      var clientPassword = req.headers['x-eirobridge-authentication'];
      if (clientPassword != rc.password) {
        socket.destroy();
        console.log("%s : Client failed to authenticate", id);
        return;
      }
    }

    active_remotes[id] = remote;
    remote.PING(function(s) { console.log("%s : PING %s", id, s); });
  });

  socket.pipe(d).pipe(socket);

  socket.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n' +
               'Upgrade: WebSocket\r\n' +
               'Connection: Upgrade\r\n' +
               '\r\n');

  socket.on('close', function() {
    if (!(delete active_remotes[id])) {
      console.log("%s : %s", id, "DISCONNECTED (" + _.size(active_remotes) + " remotes still active)");
    }
  });
});

server.listen(rc.port);
console.log("Bridge listening on port %s", rc.port);
