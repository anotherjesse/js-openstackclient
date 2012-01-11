// GOAL: runnable in both node.js & from a browser

// apache 2.0 license
// copyright openstack llc

var cli = require('cli');
var http = require('http');
var url = require('url');

function keystone(auth_url, username, password, tenant, callback) {

  function ServiceCatalog(token) {
    var catalog = {};
    token.serviceCatalog.forEach(function(service) {
      catalog[service.type] = service;
    });

    this.url_for = function(kind) {
      return catalog[kind].endpoints[0]['publicURL'];
    };
  }

  var auth = {
    "auth": {
      "passwordCredentials": {
        "username": username,
        "password": password
      },
      "tenantName": tenant
    }
  };

  $.ajax({
    type: 'POST',
    url: auth_url+'/tokens',
    data: JSON.stringify(auth),
    success: function(data) {
      var access = data['access'];
      var cat = new ServiceCatalog(access);
      callback({'token': access.token.id, 'catalog': cat});
    },
    contentType: 'application/json'
  });
}


function Nova(auth) {
  var base = auth.catalog.url_for('compute');

  function req(resource, master, callback) {
    var dest = base + resource;

    $.ajax({
      type: 'GET',
      url: dest,
      success: function(data) {
        var result = data[master];
        callback(result);
      },
      contentType: 'application/json',
      headers: {'X-AUTH-TOKEN': auth.token}
    });
  }

  this.servers = function(callback) {
    req('/servers/detail', 'servers', callback);
  };

  this.flavors = function(callback) {
    req('/flavors', 'flavors', callback);
  };
}

cli.parse();

cli.main(function(args, opts) {
  var auth_url = args[0];
  var user = args[1];
  var password = args[2];
  var tenant = user;

  // FIXME(ja): I think I would prefer an api like: (except deal with async/sync)
  // var stack = new OpenStack(auth_url, user, password, tenant);
  // stack.compute.servers()
  // stack.volume.volumes()
  // stack.identity.tenants()
  // NOTE(ja): for async whatever backbone needs?
  keystone(auth_url, user, password, tenant, function(auth) {
    var n = new Nova(auth);
    // FIXME(ja): what pattern do folks use for async?
    n.servers(function(x){ console.log(x); });
    n.flavors(function(x){ console.log(x); });
  });

});