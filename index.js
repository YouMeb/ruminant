'use strict';

var requirep = require('requirep');

var fs = requirep('fs');
var path = require('path');
var crypto = require('crypto');
var createRuminantSp = require('./sp.js');

module.exports = Ruminant;

var proto = Ruminant.prototype;

function Ruminant(options) {
  if (!(this instanceof Ruminant)) {
    return new Ruminant(options);
  }

  options || (options = {});

  this.prefix = '';
  this.conn = options.connection;
  this.pool = options.pool;
  this.dir = path.resolve(process.cwd(), options.dir || 'procedures');
  this.sp = {};
}

proto.getConn = function (conn) {
  return new Promise(function (resolve, reject) {
    if (conn) {
      return resolve(conn);
    }

    if (this.conn) {
      return resolve(this.conn);
    }

    if (this.pool) {
      this.pool.getConnection(function (err, res) {
        err ? reject(err) : resolve(res);
      });
      return;
    }

    reject(new Error('Can\'t get a mysql connection.'));
  }.bind(this));
};

proto.init = function (conn) {
  // find all files in the specific directory
  return fs.readdir(this.dir)

    // prepare for sql queries
    .then(function (names) {
      return Promise.all(names.map(this.createUpdateQuery.bind(this)));
    }.bind(this))

    // concat
    .then(function (queries) {
      return queries.join(';');
    })
    
    // get connection
    .then(function (query) {
      return this.getConn(conn)
        .then(function (conn) {
          return {
            conn: conn,
            query: query
          };
        }.bind(this));
    }.bind(this))

    // exec
    .then(function (data) {
      return new Promise(function (resolve, reject) {
        data.conn.query(data.query, function (err, res) {
          err ? reject(err) : resolve();
        });
      });
    }.bind(this));
};

proto.createUpdateQuery = function (name) {
  var filepath = path.join(this.dir, name);
  
  return fs.readFile(filepath, 'utf8')
    .then(function (sql) {
      var shasum = crypto.createHash('sha1');
      var sha = shasum.update(sql).digest('hex');
      var spname = this.prefix + sha;

      sql = 'DROP PROCEDURE IF EXISTS `{{ name }}`;\n' + sql;
      sql = sql.replace(/{{\s*name\s*}}/g, spname);

      this.sp[path.basename(name, path.extname(name))] = spname;

      return sql;
    }.bind(this));
};

proto.one = function () {
  return this.all.apply(this, arguments)
    .then(function (res) {
      return res[0];
    });
};

proto.first = proto.one;

proto.all = function () {
  var args = Array.prototype.slice.call(arguments);
  var _call = this._call.bind(this);
  var conn, name;

  if (typeof args[0] !== 'string') {
    conn = args.shift();
  }

  name = this.sp[args.shift()];

  return new Promise(function (resolve, reject) {
    if (!name) {
      return reject(new Error('Stored procedure not found.'));
    }

    this.getConn(conn)
      .then(function (conn) {
        return _call(conn, name, args);
      })
      .then(resolve)
      .catch(reject);
  }.bind(this));
};

proto.call = proto.all;

proto._call = function (conn, name, args) {
  return new Promise(function (resolve, reject) {
    var cb = function (err, res) {
      return err ? reject(err) : resolve(res[0]);
    };

    args = args
      .map(function (arg) {
        return conn.escape(arg);
      })
      .join(', ');

    conn.query('CALL ' + name + '(' + args + ')', cb);
  });
};
