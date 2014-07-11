var dynamo = exports
var http   = require("http")
var https  = require("https")
var aws4   = require("aws4")

var EventEmitter = require("events").EventEmitter;

var OperationType = {
  BatchGetItem: 'read',
  BatchWriteItem: 'write',
  DeleteItem: 'write',
  GetItem: 'read',
  PutItem: 'write',
  Query: 'read',
  Scan: 'read',
  UpdateItem: 'write'
};

function Database(region, credentials) {
  if (typeof region === "object") {
    this.host = region.host
    this.port = region.port
    this.region = region.region
    this.version = region.version // '20120810' or '20111205'
    this.agent = region.agent
    this.https = region.https
    credentials = region.credentials || credentials
  } else {
    if (/^[a-z]{2}\-[a-z]+\-\d$/.test(region))
      this.region = region
    else
      // Backwards compatibility for when 1st param was host
      this.host = region
  }
  if (!this.region) this.region = (this.host || "").split(".", 2)[1] || "us-east-1"
  if (!this.host) this.host = "dynamodb." + this.region + ".amazonaws.com"
  if (!this.version) this.version = "20120810"

  this.credentials = new Credentials(credentials || {})
  this.events = new EventEmitter();
}

Database.prototype.emit = function(name, data) {
  return this.events.emit(name, data);
}

Database.prototype.request = function(target, data, cb) {
  var self = this,
      hrstart = process.hrtime();

  if (target.indexOf('Table') == -1 && !data.ReturnConsumedCapacity) {
    data.ReturnConsumedCapacity = "TOTAL";
  }

  !function retry(database, i) {
    var req = new Request(database, target, data || {})

    aws4.sign(req, database.credentials)

    req.send(function(err, data) {
      if (err) {
        self.emit('request.error', err);

        if (i < Request.prototype.maxRetries && (
          err.statusCode >= 500 ||
          err.name == "ProvisionedThroughputExceededException" ||
          err.name == "ThrottlingException"
        )) {
          self.emit('request.retry', err.name);
          setTimeout(retry, 50 << i, database, i + 1)
        } else {
          self.emit('request.failure', err.name || "unknown");
          cb(err)
        }
      } else {
        var hrend = process.hrtime(hrstart);
        var opType = OperationType[target] || 'unknown';

        if (data && data.ConsumedCapacity && data.ConsumedCapacity.TableName) {
          self.emit('request.consumedcapacity', {
            type: opType,
            table: data.ConsumedCapacity.TableName,
            consumed: data.ConsumedCapacity.CapacityUnits || 0
          });
        }

        self.emit('request.time', {
          type: opType,
          time: hrend
        });

        cb(null, data);
      }
    })
  }(this, 0)
}

function Request(opts, target, data) {
  var headers = this.headers = {}

  this.host = opts.host
  this.port = opts.port
  this.http = opts.https ? https : http

  if ("agent" in opts) this.agent = opts.agent

  this.body = JSON.stringify(data)

  this.method      = Request.prototype.method
  this.path        = Request.prototype.path
  this.maxRetries  = Request.prototype.maxRetries
  this.contentType = Request.prototype.contentType

  headers["Host"] = this.host
  headers["Date"] = new Date().toUTCString()
  headers["Content-Length"] = Buffer.byteLength(this.body)
  headers["Content-Type"] = Request.prototype.contentType

  headers["X-Amz-Target"] = "DynamoDB_" + opts.version + "." + target
}

Request.prototype.method      = "POST"
Request.prototype.path        = "/"
Request.prototype.maxRetries  = 10
Request.prototype.contentType = "application/x-amz-json-1.0"

Request.prototype.send = function(cb) {
  var request = this.http.request(this, function(res) {
    var json = ""

    res.setEncoding("utf8")

    res.on("data", function(chunk){ json += chunk })
    res.on("end", function() {
      var response

      try { response = JSON.parse(json) } catch (e) { }

      if (res.statusCode == 200 && response != null) return cb(null, response)

      error.statusCode = res.statusCode
      if (response != null) {
        error.name = (response.__type || "").split("#").pop()
        error.message = response.message || response.Message || JSON.stringify(response)
      } else {
        if (res.statusCode == 413) json = "Request Entity Too Large"
        error.message = "HTTP/1.1 " + res.statusCode + " " + json
      }

      cb(error)
    })
  })

  var error = new Error

  request.on("error", cb)

  request.write(this.body)
  request.end()
}

function Credentials(attrs) {
  var env = process.env

  this.secretAccessKey = attrs.secretAccessKey || env.AWS_SECRET_ACCESS_KEY
  this.accessKeyId = attrs.accessKeyId || env.AWS_ACCESS_KEY_ID

  if (!this.secretAccessKey) {
    throw new Error("No secret access key available.")
  }

  if (!this.accessKeyId) {
    throw new Error("No access key id available.")
  }

  // Optional session token, if the user wants to supply one
  this.sessionToken = attrs.sessionToken
}

dynamo.Database      = Database
dynamo.Request       = Request
dynamo.Credentials   = Credentials

dynamo.createClient = function(region, credentials) {
  return new Database(region, credentials)
}
