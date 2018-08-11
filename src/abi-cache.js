const assert = require('assert')
const Structs = require('./structs')
const schema_native = require('./schema');

module.exports = AbiCache

function AbiCache(network, config) {
  // Help (or "usage") needs {defaults: true}
  config = Object.assign({}, {defaults: true}, config)
  const cache = {}

  /**
    @arg {boolean} force false when ABI is immutable.  When force is true, API
    user is still free to cache the contract object returned by eosjs.
  */
  function abiAsync(account, force = true) {
    assert(account, 'required account')

    if(force == false && cache[account] != null) {
      return Promise.resolve(cache[account])
    }

    assert(network, 'Network is required, provide config.httpEndpoint')
    return network.getCode(account).then(({abi}) => {
      assert(abi, `Missing ABI for account: ${account}`);
      abi.structs.forEach((item, index) => {
        if(schema_native[item.name]){
          item.action = schema_native[item.name].action;
          item.fields = [];
          for(let key in schema_native[item.name]['fields']){
            item.fields.push({
              name: key,
              type: schema_native[item.name]['fields'][key]
            })
          }
        }
      });
      const schema = abiToFcSchema(abi)
      const structs = Structs(config, schema) // structs = {structs, types}
      return cache[account] = Object.assign({abi, schema}, structs)
    })
  }

  function abi(account) {
    const c = cache[account]
    if(c == null) {
      throw new Error(`Abi '${account}' is not cached`)
    }
    return c
  }

  return {
    abiAsync,
    abi
  }
}


function abiToFcSchema(abi) {
  // customTypes
  // For FcBuffer
  const abiSchema = {}

  // convert abi types to Fcbuffer schema
  if(abi.types) { // aliases
    abi.types.forEach(e => {
      abiSchema[e.new_type_name] = e.type
    })
  }

  if(abi.structs) {
    abi.structs.forEach(e => {
      const fields = {}
      for(const field of e.fields) {
        fields[field.name] = field.type
      }
      abiSchema[e.name] = {base: e.base, fields}
      if(e.base === '') {
        delete abiSchema[e.name].base
      }
    })
  }

  return abiSchema
}
