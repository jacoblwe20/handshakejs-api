module.export = TransportAdapter;

var sendgrid = require('sendgrid');

function TransportAdapter ( options ) {
    this.sendgrid = sendgrid( options.username, options.password );
    this.from = options.from;
    this.body = options.body;
    this.subject = options.subject;
};

TransportAdapter.prototype.send = function ( authcode, identity, callback ) {
    var email = new this.sendgrid.Email({
            to: identity.email,
            from: this.from,
            subject: this.subject,
            html: this.body 
          });
    email.addSubVal('{{authcode}}', authcode);
    this.sendgrid.send(email, callback);
};