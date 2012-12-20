var should = require("should")
  , dynamo = require("../")
  , region = "us-east-1"
  , db     = dynamo.createClient(region)
  , name   = "jed_dynamo-client_test"

describe("dynamo", function() {
  describe("'PutItem' x 50", function() {
    it("should not throw ProvisionedThroughputExceededException", function(done) {
      for (var i = 0, n = 50, e = null; i < n; i++) {
        db.request("PutItem", {
          TableName: name,
          Item: {id: {N: i.toString()}}
        }, function(err, data) {
          if (e) return

          if (err) return done(e = err)

          --n || done()
        })
      }
    })
  })
})

describe("Database", function() {
  describe("created with no params", function() {
    var db = dynamo.createClient()
    it("should have default region", function() {
      db.region.should.equal("us-east-1")
    })
    it("should have correct host", function() {
      db.host.should.equal("dynamodb.us-east-1.amazonaws.com")
    })
  })
  describe("created with region", function() {
    var db = dynamo.createClient("ap-southeast-2")
    it("should have correct region", function() {
      db.region.should.equal("ap-southeast-2")
    })
    it("should have correct host", function() {
      db.host.should.equal("dynamodb.ap-southeast-2.amazonaws.com")
    })
  })
  describe("created with host", function() {
    var db = dynamo.createClient("dynamodb.ap-southeast-2.amazonaws.com")
    it("should have correct region", function() {
      db.region.should.equal("ap-southeast-2")
    })
    it("should have correct host", function() {
      db.host.should.equal("dynamodb.ap-southeast-2.amazonaws.com")
    })
  })
  describe("created with options", function() {
    var db = dynamo.createClient({host: "myhost", port: 8080, region: "myregion"})
    it("should have correct region", function() {
      db.region.should.equal("myregion")
    })
    it("should have correct host", function() {
      db.host.should.equal("myhost")
    })
    it("should have correct port", function() {
      db.port.should.equal(8080)
    })
  })
  describe("created with partial options", function() {
    var db = dynamo.createClient({host: "myhost", port: 8080})
    it("should have default region", function() {
      db.region.should.equal("us-east-1")
    })
  })
})
