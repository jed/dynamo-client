var should = require("should")
  , dynamo = require("../")

describe("Database", function() {

  // Save and ensure we restore process.env
  var envAccessKeyId, envSecretAccessKey

  before(function() {
    envAccessKeyId = process.env.AWS_ACCESS_KEY_ID
    envSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
    process.env.AWS_ACCESS_KEY_ID = "ABCDEF"
    process.env.AWS_SECRET_ACCESS_KEY = "abcdef1234567890"
  })

  after(function() {
    process.env.AWS_ACCESS_KEY_ID = envAccessKeyId
    process.env.AWS_SECRET_ACCESS_KEY = envSecretAccessKey
  })

  describe("created with no params", function() {
    it("should have default region", function() {
      var db = dynamo.createClient()
      db.region.should.equal("us-east-1")
    })
    it("should have correct host", function() {
      var db = dynamo.createClient()
      db.host.should.equal("dynamodb.us-east-1.amazonaws.com")
    })
  })

  describe("created with region", function() {
    it("should have correct region", function() {
      var db = dynamo.createClient("ap-southeast-2")
      db.region.should.equal("ap-southeast-2")
    })
    it("should have correct host", function() {
      var db = dynamo.createClient("ap-southeast-2")
      db.host.should.equal("dynamodb.ap-southeast-2.amazonaws.com")
    })
  })

  describe("created with host", function() {
    it("should have correct region", function() {
      var db = dynamo.createClient("dynamodb.ap-southeast-2.amazonaws.com")
      db.region.should.equal("ap-southeast-2")
    })
    it("should have correct host", function() {
      var db = dynamo.createClient("dynamodb.ap-southeast-2.amazonaws.com")
      db.host.should.equal("dynamodb.ap-southeast-2.amazonaws.com")
    })
  })

  describe("created with options", function() {
    it("should have correct region", function() {
      var db = dynamo.createClient({host: "myhost", port: 8080, region: "myregion"})
      db.region.should.equal("myregion")
    })
    it("should have correct host", function() {
      var db = dynamo.createClient({host: "myhost", port: 8080, region: "myregion"})
      db.host.should.equal("myhost")
    })
    it("should have correct port", function() {
      var db = dynamo.createClient({host: "myhost", port: 8080, region: "myregion"})
      db.port.should.equal(8080)
    })
    it("should have correct version", function() {
      var db = dynamo.createClient({version: "20111205"})
      db.version.should.equal("20111205")
    })
    it("should have correct agent", function() {
      var db = dynamo.createClient({agent: false})
      db.agent.should.equal(false)
    })
    it("should have correct https", function() {
      var db = dynamo.createClient({https: true})
      db.https.should.equal(true)
    })
  })

  describe("created with partial options", function() {
    it("should have default region", function() {
      var db = dynamo.createClient({host: "myhost", port: 8080})
      db.region.should.equal("us-east-1")
    })
    it("should have default host", function() {
      var db = dynamo.createClient({region: "ap-southeast-2"})
      db.host.should.equal("dynamodb.ap-southeast-2.amazonaws.com")
    })
    it("should have default version", function() {
      var db = dynamo.createClient({region: "ap-southeast-2"})
      db.version.should.equal("20120810")
    })
    it("should have default agent", function() {
      var db = dynamo.createClient({region: "ap-southeast-2"})
      should.strictEqual(undefined, db.agent)
    })
    it("should have default https", function() {
      var db = dynamo.createClient({region: "ap-southeast-2"})
      should.strictEqual(undefined, db.https)
    })
  })

})
