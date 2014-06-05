var dotenv      = require('dotenv');
dotenv.load();

var crypto      = require('crypto');
var redis       = require('redis');
var sanitize    = require('validator').sanitize;
var Validator   = require('validator').Validator;

var e           = module.exports;
e.ENV           = process.env.NODE_ENV || 'development';

// Constants
var DATABASE_URL            = process.env.DATABASE_URL; 
var FROM                    = process.env.FROM || "login@emailauth.io";
var SUBJECT                 = process.env.SUBJECT || "Your code: {{authcode}}. Please enter it to login.";
var BODY                    = process.env.BODY || "Your code: {{authcode}}. Please enter it to login.";
var AUTHCODE_LIFE_IN_MS     = process.env.AUTHCODE_LIFE_IN_MS || "120000";
var SMTP_ADDRESS            = process.env.SMTP_ADDRESS || "smtp.sendgrid.net";
var SMTP_PORT               = process.env.SMTP_PORT || 25;
var SMTP_USERNAME           = process.env.SMTP_USERNAME || process.env.SENDGRID_USERNAME;
var SMTP_PASSWORD           = process.env.SMTP_PASSWORD || process.env.SENDGRID_PASSWORD;
var REDIS_URL               = process.env.REDIS_URL || process.env.REDISTOGO_URL || "redis://localhost:6379";
var SALT_LENGTH             = process.env.SALT_LENGTH || 10;
var PBKDF2_ITERATIONS       = process.env.PBKDF2_ITERATIONS || 1000;
var PBKDF2_KEY_LENGTH       = process.env.PBKDF2_KEY_LENGTH || 16;

// Libraries
var redis_url = require("url").parse(REDIS_URL);
var db = redis.createClient(redis_url.port, redis_url.hostname);
if (redis_url.auth) {
  db.auth(redis_url.auth.split(":")[1]); 
}

var sendgrid    = require('sendgrid')(SMTP_USERNAME, SMTP_PASSWORD);
var port        = parseInt(process.env.PORT) || 3000;
var Hapi        = require('hapi');
server          = new Hapi.Server(+port, '0.0.0.0', { cors: true });

// Setup validation
Validator.prototype.error = function (msg) {
  this._errors.push(new Error(msg));
  return this;
}
Validator.prototype.errors = function () {
  return this._errors;
}

var randomAuthcode = function() {
  var authcode = ""; 

  for(var i=1;i <= 4;i++) {
    authcode += parseInt(Math.random(1000) * 10)+"";
  }

  return authcode;
}

// Models
//// App
var App = module.exports.App = function(self){
  var self          = self || 0;
  this._validator   = new Validator();
  this.app_name     = sanitize(self.app_name).trim().toLowerCase() || "";
  this.email        = sanitize(self.email).trim().toLowerCase() || "";
  this.salt         = self.salt || crypto.randomBytes(SALT_LENGTH).toString('hex');

  return this;
};

App.prototype.toJson = function(fn) {
  var _this   = this;

  return {
    email: _this.email,
    app_name: _this.app_name,
    salt: _this.salt
  }
};

App.prototype.create = function(fn){
  var _this   = this;
  var key     = "apps/"+_this.app_name;

  this._validator.check(_this.email, "Invalid email.").isEmail();
  this._validator.check(_this.app_name, "App_name must be alphanumeric, underscore, or dashes.").is(/^[a-z0-9\_\-]+$/);

  console.log(_this);

  this._validator.check(_this.salt, "Salt must be alphanumeric, underscore, or dashes.").is(/^[a-z0-9\_\-]+$/);

  var errors = this._validator.errors();
  delete(this._validator);

  if (errors.length) {
    fn(errors, null);
  } else {
    db.EXISTS(key, function(err, res) {
      if (err) { return fn(err, null); }

      if (res == 1) {
        var err = new Error("That app_name already exists.");
        fn(err, null);
      } else {
        db.SADD("apps", _this.app_name); 
        db.HMSET(key, _this, function(err, res) {
          fn(err, _this);
        }); 
      }
    });
  }

  return this;
};

//// Identity
var Identity = module.exports.Identity = function(self){
  var self                  = self || 0;
  this._validator           = new Validator();
  this.email                = sanitize(self.email).trim().toLowerCase() || "";
  this.authcode             = randomAuthcode() || "";
  this.authcode_expired_at  = +new Date + parseInt(AUTHCODE_LIFE_IN_MS);
  this.app_name             = sanitize(self.app_name).trim().toLowerCase() || "";

  return this;
};

Identity.prototype.toJson = function(fn) {
  var _this   = this;

  return {
    email:                _this.email,
    app_name:             _this.app_name,
    authcode_expired_at:  _this.authcode_expired_at
  }
};

Identity.prototype.create = function(fn){
  var _this         = this;
  var app_name_key  = "apps/"+_this.app_name; 
  var key           = app_name_key+"/identities/"+_this.email;

  this._validator.check(_this.email, "Invalid email.").isEmail();

  var errors = this._validator.errors();
  delete(this._validator);

  if (errors.length) {
    fn(errors, null);
  } else {
    db.EXISTS(app_name_key, function(err, res) {
      if (err) { return fn(err, null); }

      if (res == 1) {
        db.SADD(app_name_key+"/identities", _this.email); 
        db.HMSET(key, _this, function(err, res) {
          fn(err, _this);
        }); 
      } else {
        var err = new Error("Sorry, we couldn't find an app by that app_name.");
        fn(err, null);
      }
    });
  }

  return this;
};

Identity.confirm = function(identity, fn) {
  identity.email    = sanitize(identity.email).trim().toLowerCase();
  var app_key       = "apps/"+identity.app_name;
  var key           = app_key+"/identities/"+identity.email;

  db.EXISTS(key, function(err, res) {
    if (err) { return fn(err, null); }

    if (res == 1) {
      db.HGETALL(key, function(err, res) {
        if (err) { return fn(err, null); }

        var current_ms_epoch_time = +new Date;
        if (
          res.authcode && 
          res.authcode.length && 
          res.authcode === identity.authcode
        ) {
          if (res.authcode_expired_at < current_ms_epoch_time) {
            err = new Error("Sorry, that authcode has expired. Request another."); 
            return fn(err, null);
          }

          db.HSET(key, "authcode", ""); // clear authcode on success login/confirm
          db.HGETALL(app_key, function(err, app) {
            if (err) { return fn(err, null); }

            crypto.pbkdf2(identity.email, app.salt, PBKDF2_ITERATIONS, PBKDF2_KEY_LENGTH, function(err, hash) {
              if (err) { return fn(err, null); }

              identity.hash = hash.toString('hex');

              return fn(null, identity);
            });
          });

        } else {
          err = new Error("Sorry, the authcode did not match.")
          return fn(err, null);
        }
      }); 
    } else {
      var err = new Error("Sorry, we couldn't find a login request using that email.");
      return fn(err, null);
    }
  });
};

// Routes
var apps = {
  create: {
    handler: function (request) {
      var payload   = request.payload;
      var email     = payload.email;
      var app_name  = payload.app_name;
      var salt      = payload.salt;
      var app = new App({
        email: email,
        app_name: app_name,
        salt: salt
      }); 

      app.create(function(err, res) {
        if (err) {
          var message = err.length ? err[0].message : err.message;
          request.reply({success: false, error: {message: message}});
        } else {
          request.reply({success: true, app: res.toJson()});
        }
      });
    }
  }
};

var login = {
  request: {
    handler: function (request) {
      var payload   = request.payload;
      var email     = payload.email;
      var app_name  = payload.app_name;
      var identity = new Identity({
        email: email,
        app_name: app_name
      }); 

      identity.create(function(err, res) {
        if (err) {
          var message = err.length ? err[0].message : err.message;
          request.reply({success: false, error: {message: message}});
        } else {
          var identity = res.toJson();
          var email = new sendgrid.Email({
            to:       identity.email,
            from:     FROM,
            subject:  SUBJECT,
            html:     BODY 
          });
          email.addSubVal('{{authcode}}', res.authcode);
          sendgrid.send(email, function(err, json) {
            if (err) { 
              request.reply({success: false, error: {message: err.message}});
            } else {
              request.reply({success: true, identity: identity});
            }
          });
        }
      });
    }
  },

  confirm: {
    handler: function (request) {
      var payload         = request.payload;
      var confirm_payload = {
        email: payload.email,
        authcode: payload.authcode,
        app_name: payload.app_name
      }

      Identity.confirm(confirm_payload, function(err, res) {
        if (err) { 
          request.reply({success: false, error: {message: err.message}});
        } else {
          request.reply({success: true, identity: res});
        }
      });
    }
  }
};


server.route({
  method  : 'POST',
  path    : '/api/v0/apps/create',
  config  : apps.create
});

server.route({
  method  : 'POST',
  path    : '/api/v0/apps/create.json',
  config  : apps.create
});

server.route({
  method  : 'POST',
  path    : '/api/v0/login/request',
  config  : login.request
});

server.route({
  method  : 'POST',
  path    : '/api/v0/login/request.json',
  config  : login.request
});

server.route({
  method  : 'POST',
  path    : '/api/v0/login/confirm',
  config  : login.confirm
});

server.route({
  method  : 'POST',
  path    : '/api/v0/login/confirm.json',
  config  : login.confirm
});

server.start(function() {
  console.log('Handshake.js server started at: ' + server.info.uri);
});
