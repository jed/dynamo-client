var should = require("should")
  , dynamo = require("./")
  , host   = "dynamodb.us-east-1.amazonaws.com"
  , db     = dynamo.createClient(host)

describe("Database", function() {
  describe("#request('ListTables', null, cb)", function() {
    it("should return a list of tables", function(ok) {
      db.request("ListTables", null, function(err, data) {
        should.not.exist(err)
        should.exist(data)

        data.should.have.property("TableNames")

        ok()
      })
    })
  })
})
