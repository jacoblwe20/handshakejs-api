module.exports = routes;

function routes ( ) {
  var handshake = this;

  return {
    confirm : function ( data, callback ) {
      var identity = new handshake.Identity({
        email: data.email,
        appName: data.appName,
        handshake: handshake
      });

      identity.request( callback );
      // do confirm stuff
    },
    request : function ( data, callback ) {
      // do request stuff
      var identity = new handshake.Identity({
          email: data.email,
          appName: data.appName,
          handshake: handshake
        });

      identity.confirm( data.authCode, callback );
    }
  }
}