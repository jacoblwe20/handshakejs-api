
module.exports = express;

function express (  ) {
    var handshake = this;
    return function ( req, res, next ) {
        if ( req.path === handshake.paths.requestUrl ) {
            // request stuff
            handshake.routes.request( req.body, function( err, response ) {
                if ( err ) {
                    // look into creating custom errors to specify code
                    res.json(400, { 
                        message : 'Could not complete request', 
                        originalError: err.message
                    });
                }
                handshake.emit('request:login', response, req);
                res.json(200, response);
            });
            return;
        }

         if ( req.path === handshake.paths.confirmUrl ) {
            // confirm stuff
            handshake.routes.confirm( req.body, function( err, response ) {
                if ( err ) {
                    res.json(400, { 
                        message : 'Could not complete request', 
                        originalError: err.message
                    });
                }
                handshake.emit('login', response, req);
                res.json(200, response);
            });
            return;
        }
    }
}