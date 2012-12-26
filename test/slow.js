// secure env vars not available in pull requests
if (process.env.TRAVIS_SECURE_ENV_VARS == 'false') return

var should = require("should")
  , dynamo = require("../")
  , region = "us-east-1"
  , name   = "jed_dynamo-client_test"

describe("dynamo", function() {
  describe("'PutItem' x 50", function() {
    it("should not throw ProvisionedThroughputExceededException", function(done) {
      var db = dynamo.createClient(region)
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

