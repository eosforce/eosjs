'use strict';

var assert = require('assert');
var Structs = require('./structs');
var schema_native = require('./schema');

module.exports = AbiCache;
var cache = {};
function AbiCache(network, config) {
  // Help (or "usage") needs {defaults: true}
  config = Object.assign({}, { defaults: true }, config);

  /**
    @arg {boolean} force false when ABI is immutable.  When force is true, API
    user is still free to cache the contract object returned by eosjs.
  */
  function abiAsync(account) {
    var force = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

    assert(account, 'required account');

    if (cache[account]) {
      return Promise.resolve(cache[account]);
    }
    if (force == false && cache[account] != null) {
      return Promise.resolve(cache[account]);
    }

    assert(network, 'Network is required, provide config.httpEndpoint');
    return network.getAbi(account).then(function (_ref) {
      var abi = _ref.abi;

      assert(abi, 'Missing ABI for account: ' + account);

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        var _loop = function _loop() {
          var t_item = _step.value;

          if (t_item.name != t_item.type) {
            var struct = abi.structs.find(function (f_item) {
              return f_item.name == t_item.type;
            });
            t_item.type = t_item.name;
            var new_struct = JSON.parse(JSON.stringify(struct));
            new_struct.name = t_item.name;
            abi.structs.push(new_struct);
          }
        };

        for (var _iterator = abi.actions[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          _loop();
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      abi.structs.forEach(function (a_item) {
        var action = abi.actions.find(function (f_item) {
          return f_item.name == a_item.name;
        });
        if (action) {
          a_item.action = {
            account: account,
            name: action.name
          };
        }
      });

      var schema = abiToFcSchema(abi);
      var structs = Structs(config, schema);
      return cache[account] = Object.assign({ abi: abi, schema: schema }, structs);
    });
  }

  function abi(account) {
    var c = cache[account];
    if (c == null) {
      throw new Error('Abi \'' + account + '\' is not cached');
    }
    return c;
  }

  return {
    abiAsync: abiAsync,
    abi: abi
  };
}

function abiToFcSchema(abi) {
  // customTypes
  // For FcBuffer
  var abiSchema = {};

  // convert abi types to Fcbuffer schema
  if (abi.types) {
    // aliases
    abi.types.forEach(function (e) {
      abiSchema[e.new_type_name] = e.type;
    });
  }

  if (abi.structs) {
    abi.structs.forEach(function (e) {
      var fields = {};
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = e.fields[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var field = _step2.value;

          fields[field.name] = field.type;
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      abiSchema[e.name] = { base: e.base, fields: fields };
      if (e.base === '') {
        delete abiSchema[e.name].base;
      }
    });
  }

  return abiSchema;
}