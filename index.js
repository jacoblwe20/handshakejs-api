
module.exports = Index;

function Index ( options ) {

    options = options || {};

    // settings
    this.saltLength = options.saltLength || 10;
    this.pbkdf2Iterations = options.pbkdf2Iterations || 1000;
    this.pbkdf2KeyLength = options.pbkdf2KeyLength || 16;

    // adapters data, transport
    this.dataAdapter = options.dataAdapter || require('./exampleAdapters/redis');
    // TODO
    // this.transportAdapter = options.transportAdapter || require('./exampleAdapters/sendgrid');

    // TODO
    // plugable middleware
    // this.__express = require('./middleware/express').bind( this );
    // this.__hapi = require('./middleware/happi').bind( this );

    // models
    this.App = require('./src/models/app');
    // TODO
    // this.Identity = require('./src/models/identity');

};

// kinda top level so its easy to overwrite
Index.prototype.generateCode = function( ) {
    
  var authcode = ""; 

  for(var i=1;i <= 4;i++) {
    authcode += parseInt(Math.random(1000) * 10)+"";
  }

  return authcode;

};
