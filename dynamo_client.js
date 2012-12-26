var dynamo = exports
var http   = require("http")
var https  = require("https")
var crypto = require("crypto")
var aws4   = require("aws4")

function Database(region, credentials) {
  if (typeof region === "object") {
    this.host = region.host
    this.port = region.port
    this.region = region.region
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

  this.credentials = new Credentials(credentials || {})
}

Database.prototype.request = function(target, data, cb) {
  !function retry(database, i) {
    var req = new Request(database, target, data || {})

    aws4.sign(req, database.credentials)

    req.send(function(err, data) {
      if (err) {
        if (i < Request.prototype.maxRetries && (
          err.statusCode >= 500 ||
          err.name == "ProvisionedThroughputExceededException" ||
          err.name == "ThrottlingException"
        )) {
          setTimeout(retry, 50 << i, database, i + 1)
        }

        else cb(err)
      }

      else cb(null, data)
    })
  }(this, 0)
}

function Request(opts, target, data) {
  var headers = this.headers = {}

  this.host = opts.host
  this.port = opts.port

  this.body = JSON.stringify(data)

  headers["Host"] = this.host
  headers["Date"] = new Date().toUTCString()
  headers["Content-Length"] = Buffer.byteLength(this.body)
  headers["Content-Type"] = Request.prototype.contentType

  headers["X-Amz-Target"] = Request.prototype.target + target
}

Request.prototype.method      = "POST"
Request.prototype.path        = "/"
Request.prototype.target      = "DynamoDB_20111205."
Request.prototype.maxRetries  = 10
Request.prototype.contentType = "application/x-amz-json-1.0"

Request.prototype.send = function(cb) {
  var request = http.request(this, function(res) {
    var json = ""

    res.setEncoding("utf8")

    res.on("data", function(chunk){ json += chunk })
    res.on("end", function() {
      var error, response = JSON.parse(json)

      if (res.statusCode == 200) return cb(null, response)

      error = new Error
      error.name = (response.__type || '').split('#').pop()
      error.message = response.message
      error.statusCode = res.statusCode

      cb(error)
    })
  })

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
