/* global require, module */

'use strict';

var Validator = require('validator'),
  sanitize = Validator.sanitize,
  EventEmitter = require('events').EventEmitter,
  util = require('util');

module.exports = Index;
// expose default adapters
module.exports.TransportAdapter = require('./exampleAdapters/sendgrid');
module.exports.DataAdapter = require('./exampleAdapters/redis');

function Index ( options ) {

  options = options || {};

  // settings
  this.saltLength = options.saltLength || 10;
  this.pbkdf2Iterations = options.pbkdf2Iterations || 1000;
  this.pbkdf2KeyLength = options.pbkdf2KeyLength || 16;
  this.authcodeExpire = options.authcodeExpire || 120000;
  this.paths = {
    request : options.requestUrl || '/handshake/--/request',
    confirm : options.requestUrl || '/handshake/--/confirm'
  };

  // adapters ( data, transports )
  if( !options.dataAdapter ) {
    this.emit('error', new Error('Please Specify a dataAdapter'));
  }
  if( !options.transportAdapter ) {
    this.emit('error', new Error('Please Specify a dataAdapter'));
  }
  this.dataAdapter = options.dataAdapter;
  this.transportAdapter = options.transportAdapter;

  // TODO
  // plugable middleware
  this.routes = require('./lib/routes').call( this );
  this._express = require('./middleware/express').call( this );
  //this._hapi = require('./middleware/happi').bind( this );

  // models
  this.App = require('./src/models/app');
  this.Identity = require('./src/models/identity');

  this.app = new this.App({
    salt: options.salt,
    appName: options.appName,
    handshake: this
  });
  // only creates if needed
  this.app.create(function( err ){
    if ( err ) {
      this.emit('error', err);
    }
  });

}

util.inherits( Index, EventEmitter );

// kinda top level so its easy to overwrite
Index.prototype.generateCode = function( ) {
    
  var authcode = ''; 

  for( var i = 0 ; i < 4; i++ ) {
    authcode += '' + ( Math.random( 1000 ) * 10 );
  }

  return authcode;

};

Index.prototype.santize = function ( str ) {
  return sanitize( str ).trim().toLowerCase() || '';
};

Index.prototype.Validator = Validator;