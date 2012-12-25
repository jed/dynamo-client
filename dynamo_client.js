var dynamo = exports
var http   = require("http")
var https  = require("https")
var crypto = require("crypto")

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

    req.sign(database.credentials)

    req.send(function(err, data) {
      if (err) {
        if (i < Request.prototype.maxRetries && (
          err.statusCode == 500 ||
          err.statusCode == 503 ||
          err.name.slice(-38) == "ProvisionedThroughputExceededException"
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
  this.region = opts.region

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
Request.prototype.service     = "dynamodb"
Request.prototype.maxRetries  = 10
Request.prototype.contentType = "application/x-amz-json-1.0"

Request.prototype.sign = function(credentials) {
  new RequestSigner(credentials, this).sign()
}

Request.prototype.send = function(cb) {
  var request = http.request(this, function(res) {
    var json = ""

    res.setEncoding("utf8")

    res.on("data", function(chunk){ json += chunk })
    res.on("end", function() {
      var error, response = JSON.parse(json)

      if (res.statusCode == 200) return cb(null, response)

      error = new Error
      error.name = response.__type
      error.message = response.message
      error.statusCode = res.statusCode

      cb(error)
    })
  })

  request.on("error", cb)

  request.write(this.body)
  request.end()
}

// credentials expects: { accessKeyId, secretAccessKey }
// request expects: { method, path, headers, body, region, service }
function RequestSigner(credentials, request) {
  this.credentials = credentials
  this.request = request
  this.datetime = new Date(request.headers["Date"]).toISOString().replace(/[:\-]|\.\d{3}/g, "")
  this.date = this.datetime.substr(0, 8)
}

RequestSigner.prototype.sign = function() {
  var headers = this.request.headers

  headers["X-Amz-Date"] = this.datetime

  if (this.credentials.sessionToken)
    headers["X-Amz-Security-Token"] = this.credentials.sessionToken

  headers["Authorization"] = this.authHeader()
}

RequestSigner.prototype.authHeader = function() {
  return [
    "AWS4-HMAC-SHA256 Credential=" + this.credentials.accessKeyId + "/" + this.credentialString(),
    "SignedHeaders=" + this.signedHeaders(),
    "Signature=" + this.signature()
  ].join(", ")
}

RequestSigner.prototype.signature = function() {
  function hmac(key, data, encoding) {
    return crypto.createHmac("sha256", key).update(data).digest(encoding)
  }
  var kDate = hmac("AWS4" + this.credentials.secretAccessKey, this.date)
  var kRegion = hmac(kDate, this.request.region)
  var kService = hmac(kRegion, this.request.service)
  var kCredentials = hmac(kService, "aws4_request")
  return hmac(kCredentials, this.stringToSign(), "hex")
}

RequestSigner.prototype.stringToSign = function() {
  return [
    "AWS4-HMAC-SHA256",
    this.datetime,
    this.credentialString(),
    crypto.createHash("sha256").update(this.canonicalString()).digest("hex")
  ].join("\n")
}

RequestSigner.prototype.canonicalString = function() {
  var pathSplit = this.request.path.split("?", 2)
  return [
    this.request.method,
    pathSplit[0],
    pathSplit[1] || "",
    this.canonicalHeaders() + "\n",
    this.signedHeaders(),
    crypto.createHash("sha256").update(this.request.body || "").digest("hex")
  ].join("\n")
}

RequestSigner.prototype.canonicalHeaders = function() {
  var headers = this.request.headers
  function trimAll(header) {
    return header.toString().trim().replace(/\s+/g, " ")
  }
  return Object.keys(headers)
    .sort(function(a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : 1 })
    .map(function(key) { return key.toLowerCase() + ":" + trimAll(headers[key]) })
    .join("\n")
}

RequestSigner.prototype.signedHeaders = function() {
  return Object.keys(this.request.headers)
    .map(function(key) { return key.toLowerCase() })
    .sort()
    .join(";")
}

RequestSigner.prototype.credentialString = function() {
  return [
    this.date,
    this.request.region,
    this.request.service,
    "aws4_request"
  ].join("/")
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
dynamo.RequestSigner = RequestSigner
dynamo.Credentials   = Credentials

dynamo.createClient = function(region, credentials) {
  return new Database(region, credentials)
}
