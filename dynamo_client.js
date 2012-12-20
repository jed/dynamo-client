var dynamo = exports
var http   = require("http")
var https  = require("https")
var crypto = require("crypto")

function Database(host, credentials) {
  this.host        = host
  this.credentials = new Credentials(credentials || {})
}

Database.prototype.request = function(target, data, cb) {
  !function retry(database, i) {
    var req = new Request(database.host, target, data || {})

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

function Request(host, target, data) {
  var headers = this.headers = {}

  this.body = JSON.stringify(data)

  // TODO: Would be nicer to pass in region and construct host,
  // rather than the other way around
  this.region = host.split(".", 2)[1]

  headers["X-Amz-Target"] = Request.prototype.target + target
  headers["Host"] = this.host = host
  headers["Content-Length"] = Buffer.byteLength(this.body)
  headers["Content-Type"] = Request.prototype.contentType
}

Request.prototype.method      = "POST"
Request.prototype.pathname    = "/"
Request.prototype.target      = "DynamoDB_20111205."
Request.prototype.service     = "dynamodb"
Request.prototype.maxRetries  = 10
Request.prototype.contentType = "application/x-amz-json-1.0"

Request.prototype.sign = function(credentials, date) {
  var datetime = (date || new Date).toISOString().replace(/[:\-]|\.\d{3}/g, "")
    , signer = new RequestSigner(credentials, this, datetime)

  this.headers["Date"] = this.headers["X-Amz-Date"] = datetime

  if (credentials.sessionToken)
    this.headers["X-Amz-Security-Token"] = credentials.sessionToken

  this.headers["Authorization"] = signer.createAuthHeader()
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

// credentials expects: { accessKeyId, secretAccessKey }
// request expects: { method, pathname, headers, body, region, service }
// datetime expects: "yyyymmddTHHMMSSZ"
function RequestSigner(credentials, request, datetime) {
  this.credentials = credentials
  this.request = request
  this.datetime = datetime
}

RequestSigner.prototype.createAuthHeader = function() {
  return [
    "AWS4-HMAC-SHA256 Credential=" + this.credentials.accessKeyId + "/" + this.credentialString(),
    "SignedHeaders=" + this.signedHeaders(),
    "Signature=" + this.signature()
  ].join(", ")
}

RequestSigner.prototype.signature = function() {
  var kDate = this.sha256Digest("AWS4" + this.credentials.secretAccessKey, this.datetime.substr(0, 8))
  var kRegion = this.sha256Digest(kDate, this.request.region)
  var kService = this.sha256Digest(kRegion, this.request.service)
  var kCredentials = this.sha256Digest(kService, "aws4_request")
  return this.sha256Digest(kCredentials, this.stringToSign(), "hex")
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
  var pathSplit = this.request.pathname.split("?", 2)
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
  var sig = this
  return Object.keys(this.request.headers)
    .sort(function(a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : 1 })
    .map(function(key) { return key.toLowerCase() + ":" + sig.canonicalHeaderValue(key) })
    .join("\n")
}

RequestSigner.prototype.canonicalHeaderValue = function(key) {
  return this.request.headers[key].toString().replace(/\s+/g, " ").trim()
}

RequestSigner.prototype.signedHeaders = function() {
  return Object.keys(this.request.headers)
    .map(function(key) { return key.toLowerCase() })
    .sort()
    .join(";")
}

RequestSigner.prototype.credentialString = function() {
  return [
    this.datetime.substr(0, 8),
    this.request.region,
    this.request.service,
    "aws4_request"
  ].join("/")
}

RequestSigner.prototype.sha256Digest = function(key, data, encoding) {
  return crypto.createHmac("sha256", key).update(data).digest(encoding)
}

dynamo.Database      = Database
dynamo.Request       = Request
dynamo.Credentials   = Credentials
dynamo.RequestSigner = RequestSigner

dynamo.createClient = function(host, credentials) {
  return new Database(host, credentials)
}
