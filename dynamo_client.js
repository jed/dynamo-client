var dynamo = exports
var http   = require("http")
var https  = require("https")
var crypto = require("crypto")

function Database(host, strategy) {
  if (!strategy || typeof strategy.sign !== 'function') {
    strategy = new Signature(strategy)
  }
  this.host     = host
  this.strategy = strategy
}

Database.prototype.request = function(target, data, cb) {
  !function retry(database, i) {
    var req = new Request(database.host, target, data || {})

    database.strategy.sign(req, function(err) {
      if (err) return cb(err)

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
    })
  }(this, 0)
}

function Request(host, target, data) {
  var headers = this.headers = new RequestHeaders

  this.body = JSON.stringify(data)

  // TODO: Would be nicer to pass in region and construct host,
  // rather than the other way around
  this.region = host.split(".", 2)[1]

  headers["X-Amz-Target"] = Request.prototype.target + target
  headers["Host"] = this.host = host
  headers["Content-Length"] = Buffer.byteLength(this.body)
}

Request.prototype.method     = "POST"
Request.prototype.pathname   = "/"
Request.prototype.target     = "DynamoDB_20111205."
Request.prototype.service    = "dynamodb"
Request.prototype.data       = {}
Request.prototype.maxRetries = 10

Request.prototype.toString = function() {
  return this.method +
    "\n" + this.pathname +
    "\n" +
    "\n" + this.headers +
    "\n" +
    "\n" + this.body
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

function RequestHeaders() {
  this["Content-Type"] = RequestHeaders.prototype["Content-Type"]
}

RequestHeaders.prototype["Content-Type"] = "application/x-amz-json-1.0"

RequestHeaders.prototype.toString = function() {
  return "host:"                 + this["Host"] +
       "\nx-amz-date:"           + this["X-Amz-Date"] +
       "\nx-amz-security-token:" + this["X-Amz-Security-Token"] +
       "\nx-amz-target:"         + this["X-Amz-Target"]
}

function Session(attrs) {
  this.sessionCredentials = new Credentials(attrs || {})
  this.tokenCredentials = null
  this.listeners = []
}

Session.prototype.duration         = 60 * 60 * 1000
Session.prototype.refreshPadding   = 60 * 1000 //refresh 1 minute ahead of time
Session.prototype.consumedCapacity = 0

Session.prototype.sign = function(request, date, cb) {
  if (!cb) {
    cb = date
    date = new Date
  }

  this.fetch(function(err, session) {
    if (err) return cb(err)

    var hash = crypto.createHash("sha256")
      , payload

    request.headers["X-Amz-Security-Token"] = session.token
    request.headers["X-Amz-Date"] = request.headers["Date"] = date.toUTCString()

    payload = new Buffer(request.toString(), "utf8")
    hash = hash.update(payload).digest()

    request.headers["X-Amzn-Authorization"] = "AWS3 " + [
      "AWSAccessKeyId=" + session.tokenCredentials.accessKeyId,
      "Algorithm=HmacSHA256",
      "SignedHeaders=host;x-amz-date;x-amz-security-token;x-amz-target",
      "Signature=" + session.tokenCredentials.sign(hash)
    ]

    cb(null, request)
  })
}

Session.prototype.fetch = function(cb) {
  if ((this.expiration - this.refreshPadding) > new Date) return cb(null, this)

  this.listeners.push(cb) > 1 || this.refresh()
}

Session.prototype.refresh = function() {
  var req = new SessionRequest

  req.query.DurationSeconds = 0 | this.duration / 1000
  req.query.AWSAccessKeyId = this.sessionCredentials.accessKeyId
  req.query.Signature = this.sessionCredentials.sign(req.toString(), "sha256", "base64")

  req.send(function(err, data) {
    var listeners = this.listeners.splice(0)

    if (!err) {
      this.expiration = new Date(data.expiration)
      this.tokenCredentials = new Credentials(data)
      this.token = data.sessionToken
    }

    listeners.forEach(function(cb) {
      cb(err, err ? null : this)
    }, this)
  }.bind(this))
}

function SessionRequest() {
  this.query = new SessionQuery
}

SessionRequest.prototype.method   = "GET"
SessionRequest.prototype.host     = "sts.amazonaws.com"
SessionRequest.prototype.pathname = "/"

SessionRequest.prototype.toString = function() {
  return   this.method +
    "\n" + this.host   +
    "\n" + this.pathname +
    "\n" + this.query.toString().slice(1)
}

SessionRequest.prototype.send = function(cb) {
  var signature = encodeURIComponent(this.query.Signature)
    , query = this.query + "&Signature=" + signature
    , path = Request.prototype.pathname + query
    , options = { host: this.host, path: path }

  https.get(options, function(res) {
    var xml = ""

    res.on("data", function(chunk){ xml += chunk })
    res.on("end", function() {
      var response = new SessionResponse(xml)

      if (res.statusCode == 200) cb(null, response)

      else cb(new Error(
        response.type + "(" + response.code + ")\n\n" +
        response.message
      ))
    })
  })
}

function SessionQuery() {
  this.Timestamp = (new Date).toISOString().slice(0, 19) + "Z"
}

SessionQuery.prototype.Action           = "GetSessionToken"
SessionQuery.prototype.SignatureMethod  = "HmacSHA256"
SessionQuery.prototype.SignatureVersion = "2"
SessionQuery.prototype.Version          = "2011-06-15"

SessionQuery.prototype.toString = function() {
  return (
    "?AWSAccessKeyId="   + this.AWSAccessKeyId +
    "&Action="           + this.Action +
    "&DurationSeconds="  + this.DurationSeconds +
    "&SignatureMethod="  + this.SignatureMethod +
    "&SignatureVersion=" + this.SignatureVersion +
    "&Timestamp="        + encodeURIComponent(this.Timestamp) +
    "&Version="          + this.Version
  )
}

function SessionResponse(xml) {
  var tag, key, regexp = /<(\w+)>(.*)</g

  while (tag = regexp.exec(xml)) {
    key = tag[1]
    key = key.charAt(0).toLowerCase() + key.slice(1)
    this[key] = tag[2]
  }
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

  this.sign = function(data) {
    return crypto
      .createHmac("sha256", this.secretAccessKey)
      .update(data)
      .digest("base64")
  }
}

function Signature(attrs) {
  this.credentials = new Credentials(attrs || {})
}

Signature.prototype.sign = function(request, date, cb) {
  if (!cb) {
    cb = date
    date = new Date
  }

  var datetime = date.toISOString().replace(/[:\-]|\.\d{3}/g, "")
    , authRequest = new SignatureRequest(this.credentials, request, datetime)

  request.headers["Date"] = request.headers["X-Amz-Date"] = datetime
  request.headers["Authorization"] = authRequest.createHeader()

  process.nextTick(cb.bind(null, null, request))
}

// credentials expects: { accessKeyId, secretAccessKey }
// request expects: { method, pathname, headers, body, region, service }
// datetime expects: "yyyymmddTHHMMSSZ"
function SignatureRequest(credentials, request, datetime) {
  this.credentials = credentials
  this.request = request
  this.datetime = datetime
}

SignatureRequest.prototype.createHeader = function() {
  return [
    "AWS4-HMAC-SHA256 Credential=" + this.credentials.accessKeyId + "/" + this.credentialString(),
    "SignedHeaders=" + this.signedHeaders(),
    "Signature=" + this.signature()
  ].join(", ")
}

SignatureRequest.prototype.signature = function() {
  var kDate = this.sha256Digest("AWS4" + this.credentials.secretAccessKey, this.datetime.substr(0, 8))
  var kRegion = this.sha256Digest(kDate, this.request.region)
  var kService = this.sha256Digest(kRegion, this.request.service)
  var kCredentials = this.sha256Digest(kService, "aws4_request")
  return this.sha256Digest(kCredentials, this.stringToSign(), "hex")
}

SignatureRequest.prototype.stringToSign = function() {
  return [
    "AWS4-HMAC-SHA256",
    this.datetime,
    this.credentialString(),
    crypto.createHash("sha256").update(this.canonicalString()).digest("hex")
  ].join("\n")
}

SignatureRequest.prototype.canonicalString = function() {
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

SignatureRequest.prototype.canonicalHeaders = function() {
  var sig = this
  return Object.keys(this.request.headers)
    .sort(function(a, b) { return a.toLowerCase() < b.toLowerCase() ? -1 : 1 })
    .map(function(key) { return key.toLowerCase() + ":" + sig.canonicalHeaderValue(key) })
    .join("\n")
}

SignatureRequest.prototype.canonicalHeaderValue = function(key) {
  return this.request.headers[key].toString().replace(/\s+/g, " ").replace(/^\s+|\s+$/g, "")
}

SignatureRequest.prototype.signedHeaders = function() {
  return Object.keys(this.request.headers)
    .map(function(key) { return key.toLowerCase() })
    .sort()
    .join(";")
}

SignatureRequest.prototype.credentialString = function() {
  return [
    this.datetime.substr(0, 8),
    this.request.region,
    this.request.service,
    "aws4_request"
  ].join("/")
}

SignatureRequest.prototype.sha256Digest = function(key, data, encoding) {
  return crypto.createHmac("sha256", key).update(data).digest(encoding)
}

dynamo.Database         = Database
dynamo.Request          = Request
dynamo.RequestHeaders   = RequestHeaders
dynamo.Session          = Session
dynamo.SessionRequest   = SessionRequest
dynamo.SessionQuery     = SessionQuery
dynamo.SessionResponse  = SessionResponse
dynamo.Credentials      = Credentials
dynamo.Signature        = Signature
dynamo.SignatureRequest = SignatureRequest

dynamo.createClient = function(host, strategy) {
  return new Database(host, strategy)
}
