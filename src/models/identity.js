/* global require, module */

'use strict';

module.exports = Identity;

var crypto = require('crypto');

function Identity ( options ){

  options = options || {};

  this.handshake = options.handshake;
  this._validator = new this.handshake.Validator( );
  this.email = this.handshake.sanitize( options.email );
  this.authcode = this.handshake.generateCode(); // we should move this 
  this.authcodeExpiredAt = (+new Date( )) + ( +this.handshake.authcodeExpire );
  this.appName = this.handshake.sanitize( options.app_name );
  this.dataAdapter = this.handshake.dataAdapter;
  this.transportAdapter = this.handshake.transportAdapter;

}

Identity.prototype.toJson = function( ) {
  return {
    email: this.email,
    appName: this.appName,
    authcodeExpiredAt: this.authcodeExpiredAt
  };
};

Identity.prototype.checkDataApdapter = function ( ) {
  return !(
    this.dataAdapter && 
    typeof this.dataAdapter.appExsist === 'function' &&
    typeof this.dataAdapter.identityExsist === 'function' &&
    typeof this.dataAdapter.getIdentity === 'function' &&
    typeof this.dataAdapter.addIdentity === 'function'
  );
};

Identity.prototype.checkTransportApdapter = function ( ) {
  return !(
    this.transportAdapter && 
    typeof this.transportAdapter.send === 'function'
  );
};

Identity.prototype.create = function( callback ){

  var error;

  this._validator.check( this.email, 'Invalid email.').isEmail();

  error = this._validator.getError();
  delete this._validator;

  if ( error ) {
    return callback( error );
  }

  this.dataAdapter.appExsist( this.appName, this._handleAppExsist.bind( this, callback ) );
  return this;
};

Identity.prototype._handleAppExsist = function ( callback, err ) {
  if ( err ) {
    return callback( err );
  }
  if ( this.checkDataApdapter( ) ) {
    return callback( new Error( 'Your "dataAdapter" is improperly configured' ) );
  }
  this.dataAdapter.addIdentity( this.toJson(), this._handleIdentityCreate.bind( this, callback ) );
};

Identity.prototype._handleIdentityCreate = function ( callback, err ) {
  if ( err ) {
    return callback( err );
  }
  this.handshake.emit( 'create:identity', this.email );
  callback( null, this );
};

Identity.prototype.request = function( callback ) {
  // this should be refactored to allow for percise tracking of new user creation not
  // just create every time 
  this.create( function ( err, res ) {
    if ( err ) {
      return callback( err );
    }
    if ( this.checkTransportApdapter() ){
      return callback( new Error( 'Your "transportAdapter" is improperly configured' ) );
    }
    
    var data = this.toJson();

    data.authcode = this.authcode;
    this.transportAdapter( data, callback );

  }.bind( this ));
};

Identity.prototype.confirm = function( authcode, callback) {

  if ( this.checkDataApdapter( ) ) {
    return callback( new Error( 'Your "dataAdapter" is improperly configured' ) );
  }

  this.dataAdapter
    .identityExsist( identity, this._handleIdentityExsist.bind( this, authcode, callback ));
};


Identity.prototype._handleIdentityExsist = function ( authcode, callback, err, res ) {
  if ( err ) {
    return callback( err );
  }
  if ( this.checkDataApdapter( ) ) {
    return callback( new Error( 'Your "dataAdapter" is improperly configured' ) );
  }
  if ( !res ) {
    return callback( new Error( 'Identity is not found' ) ); 
  }
  this.dataAdapter.getIdentity( this.toJson(), this._handleGetIdentity.bind( this, authcode, callback ) );
};

Identity.prototype._handleGetIdentity = function ( authcode, callback, err, res ) { 

  if ( err ) {
    return callback( err );
  }

  if (
    res.authcode && 
    res.authcode.length && 
    res.authcode === authcode
  ) {
    return callback( new Error('Incorrect authcode'));
  }

  var now = +new Date();

  if (res.authcodeExpiredAt < now) {
    return callback( new Error('authcode has expired, request another.') );
  }
  // for analytics
  this.handshake.emit( 'login', identity.email );
  this.dataAdapter.clearAuthcode( identity );

  var handshake = this.handshake,
    app = handshake.app.toJson(),
    pbkdf2Iterations = handshake.pbkdf2Iterations,
    pbkdf2KeyLength = handshake.pbkdf2KeyLength;

  crypto.pbkdf2( identity.email, app.salt, pbkdf2Iterations, pbkdf2KeyLength, function( err, hash ) {
    if (err) { 
      return callback( err ); 
    }

    identity.hash = hash.toString('hex');
    callback( null, identity );
  });
};