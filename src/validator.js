/* global require, module */

'use strict';

var validator = require('validator'), 
  sanitize = validator.sanitize,
  Validator = validator.Validator;


module.exports = Validator;
module.exports.sanitize = sanitize;

// extending validator
Validator.prototype.error = function ( msg ) {
  this._errors.push( msg );
  return this;
};

Validator.prototype.getError = function () {
  return this._errors.length ? new Error( this._errors.join(', ') ) : null;
};