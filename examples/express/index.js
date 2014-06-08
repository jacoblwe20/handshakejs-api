require('dotenv').load();

var express = require('express'),
  Handshake = require('handshake'),
  transportAdapter = new Handshake.TransportAdapter({
    username : process.env.SENDGRIDUSERNAME,
    password : process.env.SENDGRIDPASSWORD
  });
  handshake = new Handshake({
      // this is a redis dataAdapter that comes with handshake
      dataAdapter : new Handshake.DataAdapter(),
      transportAdapter : transportAdapter,
      // some settings that are now configurable
      requestUrl : '/request',
      confirmUrl : '/confirm'
  });
  app = express( );

// events
handshake.on('error', function( err ){
  // something happened
});
handshake.on('login', function( user, request ){
  // user successfully logged in
});
handshake.on('request:login', function( user, request ){
  // user is trying to login
});

// use the middleware
app.use( handshake._express );
app.get('/', function( req, res ){
  res.send('Hello World');
})
app.listen( 3000 );