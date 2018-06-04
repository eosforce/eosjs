'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _require = require('eosjs-ecc'),
    Signature = _require.Signature,
    PublicKey = _require.PublicKey;

var Fcbuffer = require('fcbuffer');
var ByteBuffer = require('bytebuffer');
var assert = require('assert');

var json = { schema: require('./schema') };

var _require2 = require('./format'),
    isName = _require2.isName,
    encodeName = _require2.encodeName,
    decodeName = _require2.decodeName,
    UDecimalPad = _require2.UDecimalPad,
    UDecimalImply = _require2.UDecimalImply,
    UDecimalUnimply = _require2.UDecimalUnimply,
    parseAssetSymbol = _require2.parseAssetSymbol;

/** Configures Fcbuffer for EOS specific structs and types. */


module.exports = function () {
  var config = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  var extendedSchema = arguments[1];

  var structLookup = function structLookup(lookupName, account) {
    var cachedCode = new Set(['eosio', 'eosio']);
    if (cachedCode.has(account)) {
      return structs[lookupName];
    }
    var abi = config.abiCache.abi(account);
    var struct = abi.structs[lookupName];
    if (struct != null) {
      return struct;
    }
    // TODO: move up (before `const struct = abi.structs[lookupName]`)
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = abi.abi.actions[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var action = _step.value;
        var name = action.name,
            type = action.type;

        if (name === lookupName) {
          var _struct = abi.structs[type];
          if (_struct != null) {
            return _struct;
          }
        }
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

    throw new Error('Missing ABI struct or action: ' + lookupName);
  };

  // If nodeos does not have an ABI setup for a certain action.type, it will throw
  // an error: `Invalid cast from object_type to string` .. forceActionDataHex
  // may be used to until native ABI is added or fixed.
  var forceActionDataHex = config.forceActionDataHex != null ? config.forceActionDataHex : true;

  var override = Object.assign({}, authorityOverride, abiOverride, wasmCodeOverride(config), actionDataOverride(structLookup, forceActionDataHex), config.override);

  var _config = config,
      assetCache = _config.assetCache;


  var eosTypes = {
    name: function name() {
      return [Name];
    },
    public_key: function public_key() {
      return [variant(PublicKeyEcc)];
    },
    symbol: function symbol() {
      return [AssetSymbol(assetCache)];
    },
    asset: function asset() {
      return [Asset(assetCache)];
    }, // must come after AssetSymbol
    extended_asset: function extended_asset() {
      return [ExtendedAsset];
    }, // after Asset
    signature: function signature() {
      return [variant(SignatureType)];
    }
  };

  var customTypes = Object.assign({}, eosTypes, config.customTypes);
  config = Object.assign({ override: override }, { customTypes: customTypes }, config);

  // Do not sort transaction actions
  config.sort = Object.assign({}, config.sort);
  config.sort['action.authorization'] = true;
  config.sort['signed_transaction.signature'] = true;
  config.sort['authority.accounts'] = true;
  config.sort['authority.keys'] = true;

  var schema = Object.assign({}, json.schema, extendedSchema);

  var _Fcbuffer = Fcbuffer(schema, config),
      structs = _Fcbuffer.structs,
      types = _Fcbuffer.types,
      errors = _Fcbuffer.errors,
      fromBuffer = _Fcbuffer.fromBuffer,
      toBuffer = _Fcbuffer.toBuffer;

  if (errors.length !== 0) {
    throw new Error(JSON.stringify(errors, null, 4) + '\nin\n' + JSON.stringify(schema, null, 4));
  }

  return { structs: structs, types: types, fromBuffer: fromBuffer, toBuffer: toBuffer };
};

/**
  Name eos::types native.hpp
*/
var Name = function Name(validation) {
  return {
    fromByteBuffer: function fromByteBuffer(b) {
      var n = decodeName(b.readUint64(), false); // b is already in littleEndian
      // if(validation.debug) {
      //   console.error(`${n}`, '(Name.fromByteBuffer)')
      // }
      return n;
    },
    appendByteBuffer: function appendByteBuffer(b, value) {
      // if(validation.debug) {
      //   console.error(`${value}`, (Name.appendByteBuffer))
      // }
      b.writeUint64(encodeName(value, false)); // b is already in littleEndian
    },
    fromObject: function fromObject(value) {
      return value;
    },
    toObject: function toObject(value) {
      if (validation.defaults && value == null) {
        return '';
      }
      return value;
    }
  };
};

/**
  A variant is like having a version of an object.  A varint comes
  first and identifies which type of object this is.

  @arg {Array} variantArray array of types
*/
var variant = function variant() {
  for (var _len = arguments.length, variantArray = Array(_len), _key = 0; _key < _len; _key++) {
    variantArray[_key] = arguments[_key];
  }

  return function (validation, baseTypes, customTypes) {
    var variants = variantArray.map(function (Type) {
      return Type(validation, baseTypes, customTypes);
    });
    var staticVariant = baseTypes.static_variant(variants);

    return {
      fromByteBuffer: function fromByteBuffer(b) {
        return staticVariant.fromByteBuffer(b);
      },
      appendByteBuffer: function appendByteBuffer(b, value) {
        if (!Array.isArray(value)) {
          value = [0, value];
        }
        staticVariant.appendByteBuffer(b, value);
      },
      fromObject: function fromObject(value) {
        if (!Array.isArray(value)) {
          value = [0, value];
        }
        return staticVariant.fromObject(value)[1];
      },
      toObject: function toObject(value) {
        if (!Array.isArray(value)) {
          value = [0, value];
        }
        return staticVariant.toObject(value)[1];
      }
    };
  };
};

var PublicKeyEcc = function PublicKeyEcc(validation) {
  return {
    fromByteBuffer: function fromByteBuffer(b) {
      var bcopy = b.copy(b.offset, b.offset + 33);
      b.skip(33);
      var pubbuf = Buffer.from(bcopy.toBinary(), 'binary');
      return PublicKey.fromBuffer(pubbuf).toString();
    },
    appendByteBuffer: function appendByteBuffer(b, value) {
      // if(validation.debug) {
      //   console.error(`${value}`, 'PublicKeyType.appendByteBuffer')
      // }
      var buf = PublicKey.fromStringOrThrow(value).toBuffer();
      b.append(buf.toString('binary'), 'binary');
    },
    fromObject: function fromObject(value) {
      return value;
    },
    toObject: function toObject(value) {
      if (validation.defaults && value == null) {
        return 'EOS6MRy..';
      }
      return value;
    }
  };
};

/** Current action within a transaction. */
var currentAccount = void 0;

/** @private */
function precisionCache(assetCache, sym) {
  var assetSymbol = parseAssetSymbol(sym);
  var precision = assetSymbol.precision;

  /*
    if(currentAccount) {
      const asset = assetCache.lookup(assetSymbol.symbol, currentAccount)
      if(asset) {
        if(precision == null) {
          precision = asset.precision
        } else {
          assert.equal(asset.precision, precision,
            `Precision mismatch for asset: ${sym}@${currentAccount}`)
        }
      } else {
        // Lookup data for later (appendByteBuffer needs it)
        assetCache.lookupAsync(assetSymbol.symbol, currentAccount)
      }
    }*/
  precision = 4;
  return { symbol: assetSymbol.symbol, precision: precision };
}

var AssetSymbol = function AssetSymbol(assetCache) {
  return function (validation) {
    return {
      fromByteBuffer: function fromByteBuffer(b) {
        var bcopy = b.copy(b.offset, b.offset + 8);
        b.skip(8);

        var precision = bcopy.readUint8();
        var bin = bcopy.toBinary();

        var symbol = '';
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = bin[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var code = _step2.value;

            if (code == '\0') {
              break;
            }
            symbol += code;
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

        precisionCache(assetCache, precision + ',' + symbol); // validate
        return precision + ',' + symbol;
      },
      appendByteBuffer: function appendByteBuffer(b, value) {
        var _precisionCache = precisionCache(assetCache, value),
            symbol = _precisionCache.symbol,
            precision = _precisionCache.precision;

        assert(precision != null, 'Precision unknown for asset: ' + symbol + '@' + currentAccount);
        var pad = '\0'.repeat(7 - symbol.length);
        b.append(String.fromCharCode(precision) + symbol + pad);
      },
      fromObject: function fromObject(value) {
        var _precisionCache2 = precisionCache(assetCache, value),
            symbol = _precisionCache2.symbol,
            precision = _precisionCache2.precision;

        if (precision == null) {
          return symbol;
        } else {
          // Internal object, this can have the precision prefix
          return precision + ',' + symbol;
        }
      },
      toObject: function toObject(value) {
        if (validation.defaults && value == null) {
          return 'SYS';
        }
        // symbol only (without precision prefix)
        return precisionCache(assetCache, value).symbol;
      }
    };
  };
};

/** @example '0.0001 CUR' */
var Asset = function Asset(assetCache) {
  return function (validation, baseTypes, customTypes) {
    var amountType = baseTypes.int64(validation);
    var symbolType = customTypes.symbol(validation);

    function toAssetString(value) {
      if (typeof value === 'string') {
        var _value$split = value.split(' '),
            _value$split2 = _slicedToArray(_value$split, 2),
            amount = _value$split2[0],
            sym = _value$split2[1];

        var _precisionCache3 = precisionCache(assetCache, sym),
            precision = _precisionCache3.precision,
            symbol = _precisionCache3.symbol;

        if (precision == null) {
          return value;
        }
        return UDecimalPad(amount, precision) + ' ' + symbol;
      }
      if ((typeof value === 'undefined' ? 'undefined' : _typeof(value)) === 'object') {
        var _precisionCache4 = precisionCache(assetCache, value.symbol),
            _precision = _precisionCache4.precision,
            _symbol = _precisionCache4.symbol;

        assert(_precision != null, 'Precision unknown for asset: ' + _symbol + '@' + currentAccount);
        return UDecimalUnimply(value.amount, _precision) + ' ' + _symbol;
      }
      return value;
    }

    return {
      fromByteBuffer: function fromByteBuffer(b) {
        var amount = amountType.fromByteBuffer(b);
        var sym = symbolType.fromByteBuffer(b);

        var _precisionCache5 = precisionCache(assetCache, sym),
            precision = _precisionCache5.precision;

        return UDecimalUnimply(amount, precision) + ' ' + sym;
      },
      appendByteBuffer: function appendByteBuffer(b, value) {
        assert.equal(typeof value === 'undefined' ? 'undefined' : _typeof(value), 'string', 'expecting string, got ' + (typeof value === 'undefined' ? 'undefined' : _typeof(value)));

        var _value$split3 = value.split(' '),
            _value$split4 = _slicedToArray(_value$split3, 2),
            amount = _value$split4[0],
            sym = _value$split4[1];

        var _precisionCache6 = precisionCache(assetCache, sym),
            precision = _precisionCache6.precision;

        assert(precision != null, 'Precision unknown for asset: ' + sym + '@' + currentAccount);
        amountType.appendByteBuffer(b, UDecimalImply(amount, precision));
        symbolType.appendByteBuffer(b, sym);
      },
      fromObject: function fromObject(value) {
        return toAssetString(value);
      },
      toObject: function toObject(value) {
        if (validation.defaults && value == null) {
          return '0.0001 SYS';
        }
        return toAssetString(value);
      }
    };
  };
};

var ExtendedAsset = function ExtendedAsset(validation, baseTypes, customTypes) {
  var assetType = customTypes.asset(validation);
  var contractName = customTypes.name(validation);

  function toString(value) {
    assert.equal(typeof value === 'undefined' ? 'undefined' : _typeof(value), 'string', 'extended_asset is expecting a string like: 9.9999 SBL@contract');

    var _value$split5 = value.split('@'),
        _value$split6 = _slicedToArray(_value$split5, 2),
        asset = _value$split6[0],
        _value$split6$ = _value$split6[1],
        contract = _value$split6$ === undefined ? 'eosio' : _value$split6$;

    currentAccount = contract;
    return assetType.fromObject(asset) + '@' + contract;
  }

  return {
    fromByteBuffer: function fromByteBuffer(b) {
      var asset = assetType.fromByteBuffer(b);
      var contract = contractName.fromByteBuffer(b);
      currentAccount = contract;
      return asset + '@' + contract;
    },
    appendByteBuffer: function appendByteBuffer(b, value) {
      assert.equal(typeof value === 'undefined' ? 'undefined' : _typeof(value), 'string', 'value');

      var _value$split7 = value.split('@'),
          _value$split8 = _slicedToArray(_value$split7, 2),
          asset = _value$split8[0],
          contract = _value$split8[1];

      currentAccount = contract;
      assetType.appendByteBuffer(b, asset);
      contractName.appendByteBuffer(b, contract);
    },
    fromObject: function fromObject(value) {
      return toString(value);
    },
    toObject: function toObject(value) {
      if (validation.defaults && value == null) {
        return '0.0001 SYS@eosio';
      }
      return toString(value);
    }
  };
};

var SignatureType = function SignatureType(validation, baseTypes) {
  var signatureType = baseTypes.fixed_bytes65(validation);
  return {
    fromByteBuffer: function fromByteBuffer(b) {
      var signatureBuffer = signatureType.fromByteBuffer(b);
      var signature = Signature.from(signatureBuffer);
      return signature.toString();
    },
    appendByteBuffer: function appendByteBuffer(b, value) {
      var signature = Signature.from(value);
      signatureType.appendByteBuffer(b, signature.toBuffer());
    },
    fromObject: function fromObject(value) {
      var signature = Signature.from(value);
      return signature.toString();
    },
    toObject: function toObject(value) {
      if (validation.defaults && value == null) {
        return 'SIG_K1_bas58signature..';
      }
      var signature = Signature.from(value);
      return signature.toString();
    }
  };
};

var authorityOverride = {
  /** shorthand `EOS6MRyAj..` */
  'authority.fromObject': function authorityFromObject(value) {
    if (PublicKey.fromString(value)) {
      return {
        threshold: 1,
        keys: [{ key: value, weight: 1 }]
      };
    }
    if (typeof value === 'string') {
      var _value$split9 = value.split('@'),
          _value$split10 = _slicedToArray(_value$split9, 2),
          account = _value$split10[0],
          _value$split10$ = _value$split10[1],
          permission = _value$split10$ === undefined ? 'active' : _value$split10$;

      return {
        threshold: 1,
        accounts: [{
          permission: {
            actor: account,
            permission: permission
          },
          weight: 1
        }]
      };
    }
  }
};

var abiOverride = {
  'abi.fromObject': function abiFromObject(value) {
    if (typeof value === 'string') {
      return JSON.parse(value);
    }
    if (Buffer.isBuffer(value)) {
      return JSON.parse(value.toString());
    }
  }
};

var wasmCodeOverride = function wasmCodeOverride(config) {
  return {
    'setcode.code.fromObject': function setcodeCodeFromObject(_ref) {
      var object = _ref.object,
          result = _ref.result;
      var binaryen = config.binaryen;

      assert(binaryen != null, 'required: config.binaryen = require("binaryen")');
      try {
        var code = object.code.toString();
        if (/^\s*\(module/.test(code)) {
          if (config.debug) {
            console.log('Assembling WASM..');
          }
          var wasm = Buffer.from(binaryen.parseText(code).emitBinary());
          result.code = wasm;
        } else {
          result.code = object.code;
        }
      } catch (error) {
        console.error(error, object.code);
        throw error;
      }
    }
  };
};

/**
  Nested serialized structure.  Nested struct may be in HEX or object format.
*/
var actionDataOverride = function actionDataOverride(structLookup, forceActionDataHex) {
  return {
    'action.data.fromByteBuffer': function actionDataFromByteBuffer(_ref2) {
      var fields = _ref2.fields,
          object = _ref2.object,
          b = _ref2.b,
          config = _ref2.config;

      currentAccount = object.account;
      var ser = (object.name || '') == '' ? fields.data : structLookup(object.name, object.account);
      if (ser) {
        b.readVarint32(); // length prefix (usefull if object.name is unknown)
        object.data = ser.fromByteBuffer(b, config);
      } else {
        // console.log(`Unknown Action.name ${object.name}`)
        var lenPrefix = b.readVarint32();
        var bCopy = b.copy(b.offset, b.offset + lenPrefix);
        b.skip(lenPrefix);
        object.data = Buffer.from(bCopy.toBinary(), 'binary');
      }
    },

    'action.data.appendByteBuffer': function actionDataAppendByteBuffer(_ref3) {
      var fields = _ref3.fields,
          object = _ref3.object,
          b = _ref3.b;

      currentAccount = object.account;
      var ser = (object.name || '') == '' ? fields.data : structLookup(object.name, object.account);
      if (ser) {
        var b2 = new ByteBuffer(ByteBuffer.DEFAULT_CAPACITY, ByteBuffer.LITTLE_ENDIAN);
        ser.appendByteBuffer(b2, object.data);
        b.writeVarint32(b2.offset);
        b.append(b2.copy(0, b2.offset), 'binary');
      } else {
        // console.log(`Unknown Action.name ${object.name}`)
        var data = typeof object.data === 'string' ? new Buffer(object.data, 'hex') : object.data;
        if (!Buffer.isBuffer(data)) {
          throw new TypeError('Unknown struct \'' + object.name + '\' for contract \'' + object.account + '\', locate this struct or provide serialized action.data');
        }
        b.writeVarint32(data.length);
        b.append(data.toString('binary'), 'binary');
      }
    },

    'action.data.fromObject': function actionDataFromObject(_ref4) {
      var fields = _ref4.fields,
          object = _ref4.object,
          result = _ref4.result;
      var data = object.data,
          name = object.name;

      currentAccount = object.account;

      var ser = (name || '') == '' ? fields.data : structLookup(name, object.account);
      if (ser) {
        if ((typeof data === 'undefined' ? 'undefined' : _typeof(data)) === 'object') {
          result.data = ser.fromObject(data); // resolve shorthand
          return;
        } else if (typeof data === 'string') {
          var buf = new Buffer(data, 'hex');
          result.data = Fcbuffer.fromBuffer(ser, buf);
        } else {
          throw new TypeError('Expecting hex string or object in action.data');
        }
      } else {
        // console.log(`Unknown Action.name ${object.name}`)
        result.data = data;
      }
    },

    'action.data.toObject': function actionDataToObject(_ref5) {
      var fields = _ref5.fields,
          object = _ref5.object,
          result = _ref5.result,
          config = _ref5.config;

      var _ref6 = object || {},
          data = _ref6.data,
          name = _ref6.name,
          account = _ref6.account;

      currentAccount = object.account;

      var ser = (name || '') == '' ? fields.data : structLookup(name, object.account);
      if (!ser) {
        // Types without an ABI will accept hex
        // const b2 = new ByteBuffer(ByteBuffer.DEFAULT_CAPACITY, ByteBuffer.LITTLE_ENDIAN)
        // const buf = !Buffer.isBuffer(data) ? new Buffer(data, 'hex') : data
        // b2.writeVarint32(buf.length)
        // b2.append(buf)
        // result.data = b2.copy(0, b2.offset).toString('hex')
        result.data = Buffer.isBuffer(data) ? data.toString('hex') : data;
        return;
      }

      if (forceActionDataHex) {
        var b2 = new ByteBuffer(ByteBuffer.DEFAULT_CAPACITY, ByteBuffer.LITTLE_ENDIAN);
        if (data) {
          ser.appendByteBuffer(b2, data);
        }
        result.data = b2.copy(0, b2.offset).toString('hex');

        // console.log('result.data', result.data)
        return;
      }

      // Serializable JSON
      result.data = ser.toObject(data, config);
    }
  };
};