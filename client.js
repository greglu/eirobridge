var reconnect = require('reconnect');
var shoe = require('shoe');
var dnode = require('dnode');
var net = require('net');
var sys = require("sys");

var server_remote;

reconnect(function (conn) {
  var d = dnode();
  d.on('remote', function (remote) {

    server_remote = remote;

    remote.transform('baeioup', function (s) {
      console.log(s);
    });

  });

  conn.pipe(d).pipe(conn);
}).connect(8008);


var stdin = process.openStdin();
stdin.addListener("data", function (d) {
  // note:  d is an object, and when converted to a string it will
  // end with a linefeed.  so we (rather crudely) account for that
  // with toString() and then substring()
  var input = d.toString().substring(0, d.length-1);
  // console.log("you entered: [" + input + "]");

  server_remote.transform(input, function (s) {
    console.log(s);
  });
});
