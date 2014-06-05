
module.exports = DataAdapter;

var redis = require('redis'),
    url = require("url");

function DataAdapter ( url ) {
    this.url = url;
    this._url = url.parse( url );
    this.db = redis.createClient( this.url.port, this.url.hostname );
    if ( this._url.auth ) {
        this.auth( this._url.auth );
    }
}

DataAdapter.prototype.auth = function ( creds ) {
    this.db.auth( creds.split(':')[1] );
};

DataAdapter.prototype.appExsist = function ( appName, callback ) {
    this.db.EXSIST( appName, callback );
};

DataAdapter.prototype.addApp = function ( app, callback ) {
    this.db.SADD( 'apps', app.name );
    this.db.HMSET( 'apps/' + app.name, app, function ( err ) {
        callback( err, app );
    });
};

