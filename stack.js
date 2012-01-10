// GOAL: runnable in both node.js & from a browser

// apache 2.0 license
// copyright openstack llc

var cli = require('cli');
var http = require('http');
var url = require('url');

function keystone(auth_url, username, password, tenant, callback) {

  function ServiceCatalog(token) {
    var catalog = {}
    token.serviceCatalog.forEach(function(service) {
      catalog[service.type] = service
    });

    this.url_for = function(kind) {
      return catalog[kind].endpoints[0]['publicURL'];
    }
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

  var options = url.parse(auth_url + '/tokens');
  options.method = 'POST';
  options.headers = {'Content-Type': 'application/json'}

  var req = http.request(options, function(res) {
    // FIXME(ja): wait for entire body to come back!
    res.on('data', function(chunk) {
      var data = JSON.parse(chunk)['access'];
      var cat = new ServiceCatalog(data);

      callback({'token': data.token.id, 'catalog': cat})
    });
  });
  req.write(JSON.stringify(auth))
  req.end();
}


function Nova(auth) {
  var base = auth.catalog.url_for('compute');

  function req(resource, master, callback) {
    var dest = base + resource;

    var options = url.parse(dest);
    options.method = 'GET';
    options.headers = {'Content-Type': 'application/json',
                       'X-AUTH-TOKEN': auth.token}

    http.request(options, function(res) {
      // FIXME(ja): wait for entire body to come back!
      res.on('data', function(chunk) {
        var servers = JSON.parse(chunk)[master];
        callback(servers);
      });
    }).end();
  }

  this.servers = function(callback) {
    req('/servers/detail', 'servers', callback);
  }

  this.flavors = function(callback) {
    req('/flavors', 'flavors', callback)
  }
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
    n.servers(console.log);
    n.flavors(console.log);
  });

});