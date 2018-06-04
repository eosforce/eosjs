'use strict';

/* eslint-env mocha */
var assert = require('assert');
var Fcbuffer = require('fcbuffer');

var Eos = require('.');

describe('shorthand', function () {

  it('asset', function () {
    var eos = Eos.Localnet();
    var types = eos.fc.types;

    var AssetType = types.asset();

    assertSerializer(AssetType, '1.0000 SYS');

    var obj = AssetType.fromObject('1 SYS');
    assert.equal(obj, '1.0000 SYS');

    var obj2 = AssetType.fromObject({ amount: 10000, symbol: 'SYS' });
    assert.equal(obj, '1.0000 SYS');
  });

  it('authority', function () {
    var eos = Eos.Localnet();
    var authority = eos.fc.structs.authority;


    var pubkey = 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV';
    var auth = { threshold: 1, keys: [{ key: pubkey, weight: 1 }] };

    assert.deepEqual(authority.fromObject(pubkey), auth);
    assert.deepEqual(authority.fromObject(auth), Object.assign({}, auth, { accounts: [], waits: [] }));
  });

  it('PublicKey sorting', function () {
    var eos = Eos.Localnet();
    var authority = eos.fc.structs.authority;


    var pubkeys = ['EOS7wBGPvBgRVa4wQN2zm5CjgBF6S7tP7R3JavtSa2unHUoVQGhey', 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV'];

    var authSorted = { threshold: 1, keys: [{ key: pubkeys[1], weight: 1 }, { key: pubkeys[0], weight: 1 }], accounts: [], waits: [] };

    var authUnsorted = { threshold: 1, keys: [{ key: pubkeys[0], weight: 1 }, { key: pubkeys[1], weight: 1 }], accounts: [], waits: []

      // assert.deepEqual(authority.fromObject(pubkey), auth)
    };assert.deepEqual(authority.fromObject(authUnsorted), authSorted);
  });

  it('public_key', function () {
    var eos = Eos.Localnet();
    var _eos$fc = eos.fc,
        structs = _eos$fc.structs,
        types = _eos$fc.types;

    var PublicKeyType = types.public_key();
    var pubkey = 'EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV';
    // 02c0ded2bc1f1305fb0faac5e6c03ee3a1924234985427b6167ca569d13df435cf
    assertSerializer(PublicKeyType, pubkey);
  });

  it('extended_asset', function () {
    var eos = Eos.Localnet({ defaults: true });
    var eaType = eos.fc.types.extended_asset();
    var eaString = eaType.toObject();
    assertSerializer(eaType, eaString);
    assert.equal(eaType.toObject('1 SYS'), '1.0000 SYS@eosio.token');
  });

  it('symbol', function () {
    var eos = Eos.Localnet();
    var types = eos.fc.types;

    var ExtendedAssetType = types.extended_asset();

    assertSerializer(ExtendedAssetType, '1.0000 SYS@eosio.token');

    // const obj = AssetSymbolType.fromObject('1.000 SYS@eosio.token')
    // const buf = Fcbuffer.toBuffer(AssetSymbolType, obj)
    // assert.equal(buf.toString('hex'), '04454f5300000000')
  });

  it('signature', function () {
    var eos = Eos.Localnet();
    var types = eos.fc.types;

    var SignatureType = types.signature();
    var signatureString = 'SIG_K1_JwxtqesXpPdaZB9fdoVyzmbWkd8tuX742EQfnQNexTBfqryt2nn9PomT5xwsVnUB4m7KqTgTBQKYf2FTYbhkB5c7Kk9EsH';
    //const signatureString = 'SIG_K1_Jzdpi5RCzHLGsQbpGhndXBzcFs8vT5LHAtWLMxPzBdwRHSmJkcCdVu6oqPUQn1hbGUdErHvxtdSTS1YA73BThQFwV1v4G5'
    assertSerializer(SignatureType, signatureString);
  });
});

if (process.env['NODE_ENV'] === 'development') {

  describe('Eosio Abi', function () {

    it('Eosio token contract parses', function (done) {
      var eos = Eos.Localnet();

      eos.contract('eosio.token', function (error, eosio_token) {
        assert(!error, error);
        assert(eosio_token.transfer, 'eosio.token contract');
        assert(eosio_token.issue, 'eosio.token contract');
        done();
      });
    });
  });
}

describe('Message.data', function () {
  it('json', function () {
    var eos = Eos.Localnet({ forceActionDataHex: false });
    var _eos$fc2 = eos.fc,
        structs = _eos$fc2.structs,
        types = _eos$fc2.types;

    var value = {
      account: 'eosio.token',
      name: 'transfer',
      data: {
        from: 'inita',
        to: 'initb',
        quantity: '1.0000 SYS',
        memo: ''
      },
      authorization: []
    };
    assertSerializer(structs.action, value);
  });

  it('hex', function () {
    var eos = Eos.Localnet({ forceActionDataHex: false, debug: false });
    var _eos$fc3 = eos.fc,
        structs = _eos$fc3.structs,
        types = _eos$fc3.types;


    var tr = { from: 'inita', to: 'initb', quantity: '1.0000 SYS', memo: '' };
    var hex = Fcbuffer.toBuffer(structs.transfer, tr).toString('hex');
    // const lenPrefixHex = Number(hex.length / 2).toString(16) + hex.toString('hex')

    var value = {
      account: 'eosio.token',
      name: 'transfer',
      data: hex,
      authorization: []
    };

    var type = structs.action;
    var obj = type.fromObject(value); // tests fromObject
    var buf = Fcbuffer.toBuffer(type, obj); // tests appendByteBuffer
    var obj2 = Fcbuffer.fromBuffer(type, buf); // tests fromByteBuffer
    var obj3 = type.toObject(obj); // tests toObject

    assert.deepEqual(Object.assign({}, value, { data: tr }), obj3, 'serialize object');
    assert.deepEqual(obj3, obj2, 'serialize buffer');
  });

  it('force hex', function () {
    var eos = Eos.Localnet({ forceActionDataHex: true });
    var _eos$fc4 = eos.fc,
        structs = _eos$fc4.structs,
        types = _eos$fc4.types;

    var value = {
      account: 'eosio.token',
      name: 'transfer',
      data: {
        from: 'inita',
        to: 'initb',
        quantity: '1 SYS',
        memo: ''
      },
      authorization: []
    };
    var type = structs.action;
    var obj = type.fromObject(value); // tests fromObject
    var buf = Fcbuffer.toBuffer(type, obj); // tests appendByteBuffer
    var obj2 = Fcbuffer.fromBuffer(type, buf); // tests fromByteBuffer
    var obj3 = type.toObject(obj); // tests toObject

    var data = Fcbuffer.toBuffer(structs.transfer, value.data);
    var dataHex = //Number(data.length).toString(16) +
    data.toString('hex');

    assert.deepEqual(Object.assign({}, value, { data: dataHex }), obj3, 'serialize object');
    assert.deepEqual(obj3, obj2, 'serialize buffer');
  });

  it('unknown type', function () {
    var eos = Eos.Localnet({ forceActionDataHex: false });
    var _eos$fc5 = eos.fc,
        structs = _eos$fc5.structs,
        types = _eos$fc5.types;

    var value = {
      account: 'eosio.token',
      name: 'mytype',
      data: '030a0b0c',
      authorization: []
    };
    assertSerializer(structs.action, value);
  });
});

function assertSerializer(type, value) {
  var obj = type.fromObject(value); // tests fromObject
  var buf = Fcbuffer.toBuffer(type, obj); // tests appendByteBuffer
  var obj2 = Fcbuffer.fromBuffer(type, buf); // tests fromByteBuffer
  var obj3 = type.toObject(obj); // tests toObject

  assert.deepEqual(value, obj3, 'serialize object');
  assert.deepEqual(obj3, obj2, 'serialize buffer');
}