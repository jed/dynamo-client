var should = require("should")
  , dynamo = require("../")
  , host   = "dynamodb.us-east-1.amazonaws.com"
  , db     = dynamo.createClient(host)
  , name   = "jed_dynamo-client_test"

describe("dynamo", function() {
  describe("'PutItem' x 50", function() {
    it("should not throw ProvisionedThroughputExceededException", function(done) {
      for (var i = 0, n = 25, e = null; i < n; i++) {
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
