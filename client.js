var http = require('http');
var dnode = require('dnode');

var req = http.request({
  port: 8008,
  hostname: 'localhost',
  headers: {
    'Connection': 'Upgrade',
    'Upgrade': 'websocket'
  }
});
req.end();

var server_remote;

req.on('upgrade', function(res, socket, upgradeHead) {
  var d = dnode({
    broadcast: function(payload, cb) {
      console.log('--- OUTPUTTING BROADCAST ---');
      console.log(payload);
      console.log('--- FINISHED BROADCAST ---');
    }
  });

  d.on('remote', function (remote) {
    server_remote = remote;
  });

  socket.pipe(d).pipe(socket);

  socket.on('close', function() {
    console.log('Server connection closed!');
  });

});
