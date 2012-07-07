var should = require("should")
  , dynamo = require("./")
  , host   = "dynamodb.us-east-1.amazonaws.com"
  , db     = dynamo.createClient(host)

describe("Database", function() {
  describe("#request('ListTables', {}, cb)", function() {
    it("should return a list of tables", function(done) {
      db.request("ListTables", {}, function(err, data) {
        should.not.exist(err)
        should.exist(data)

        data.should.have.property("TableNames")

        done()
      })
    })
  })
})
