
module.exports = DataAdapter;

var redis = require('redis'),
    url = require("url");

function DataAdapter ( url ) {
    this.url = url || "redis://localhost:6379";
    this._url = url.parse( url );
    this.db = redis.createClient( this.url.port, this.url.hostname );
    if ( this._url.auth ) {
        this.auth( this._url.auth );
    }
}

DataAdapter.prototype.auth = function ( creds ) {
    // check if this is standard
    this.db.auth( creds.split(':')[1] );
};

DataAdapter.prototype.appExsist = function ( appName, callback ) {
    this.db.EXSIST( 'apps/' + appName, callback );
};

DataAdapter.prototype.identityExsist = function ( identity, callback ) {
    this.db.EXSIST( 'apps/' + identity.appName + '/identities/' + identity.email, callback );
};

DataAdapter.prototype.addApp = function ( app, callback ) {
    this.db.SADD( 'apps', app.appName );
    this.db.HMSET( 'apps/' + app.appName, app, function ( err ) {
        callback( err, app );
    });
};

DataAdapter.prototype.addIdentity = function ( identity, callback ) {
    var key = 'apps/' + identity.appName;
    this.db.SADD( key + '/identities',  identity.email );
    this.db.HMSET( key + '/identities/' + identity.email, identity, callback);
};

DataAdapter.prototype.getApp = function ( appName, callback ) {
    this.db.HGETALL( 'apps/' + appName, callback );
};

DataAdapter.prototype.getIdentity = function ( identity, callback ) {
    this.db.HGETALL( 'apps/' + identity.appName + '/identities/' + identity.email, callback );
};

DataAdapter.prototype.clearAuthcode = function ( identity ) {
    this.db.HMSET( 'apps/' + identity.appName + '/identities/' + identity.email, 'authcode', '');
};