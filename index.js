var http = require('http');
var util = require('util');
var ecstatic = require('ecstatic')(__dirname + '/public');
var shoe = require('shoe');
var dnode = require('dnode');
var uuid = require('node-uuid');
var levelup = require('levelup');

var net = require('net');

var db = levelup('./subscribers');
var clients = {};
var remotes = {};


var server = net.createServer(function (conn) {

  var d = dnode({
    transform : function (s, cb) {
      cb(s + ' => ' + s.toUpperCase());
      // cb(s.replace(/[aeiou]{2,}/, 'oo').toUpperCase())
    }
  });

  conn.pipe(d).pipe(conn);

});

server.listen(8008);
