/* global require, module */

'use strict';

/* think about adding in promise library to for control flow */


module.exports = App;

var crypto = require('crypto');

/* app model */

function App (options){
  
  options = options || {};

  this.handshake = options.handshake;
  this._validator = new this.handshake.Validator();
  this.appName = this.handshake.sanitize( options.appName );
  this.email = this.handshake.sanitize( options.email );
  this.salt = options.salt || crypto.randomBytes( options.saltLength ).toString('hex');
  this.dataAdapter = options.dataAdapter;

  return this;
}

App.prototype.toJson = function(  ) {
  return {
    email: this.email,
    appName: this.appName,
    salt: this.salt
  };
};

App.prototype.checkApdapter = function ( ) {
  return !(
    this.dataAdapter && 
    typeof this.dataAdapter.appExsist === 'function' &&
    typeof this.dataAdapter.addApp === 'function'
  );
};

App.prototype.create = function( callback ){

  var error;

  this._validator
    .check(this.email, 'Invalid email.')
    .isEmail();
  this._validator
    .check(this.app_name, 'App_name must be alphanumeric, underscore, or dashes.')
    .is(/^[a-z0-9\_\-]+$/);
  this._validator
    .check(this.salt, 'Salt must be alphanumeric, underscore, or dashes.')
    .is(/^[a-z0-9\_\-]+$/);

  error = this._validator.getError( );
  delete this._validator;

  if ( error ) {
    return callback( error, null );
  }

  if ( this.checkApdapter( ) ) {
    return callback( new Error( 'Your "dataAdapter" is improperly configured' ));
  }

  this.dataAdapter.appExsist( this.appName, this._handleAppExsist.bind( this, callback ) );
  return this;
};

App.prototype._handleAppExsist = function ( callback, err ) {
  if ( err ) {
    return callback( err );
  }
  if ( this.checkApdapter( ) ) {
    return callback( new Error( 'Your "dataAdapter" is improperly configured' ));
  }
  this.dataAdapter.addApp( this.toJson(), this._handleAppCreate.bind( this, callback ) );
};

App.prototype._handleAppCreate = function ( callback, err ) {
  if ( err ) {
    return callback( err );
  }
  // for analytics
  this.handshake.emit( 'create:app', this.appName );
  callback( null, this );
};