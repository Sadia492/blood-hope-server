const express = require("express");
const cors = require("cors");
require("dotenv").config();

const port = process.env.PORT || 9000;
const app = express();

const jwt = require("jsonwebtoken");

app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Pass}@cluster0.dr5qw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
// middlewares
const verifyToken = (req, res, next) => {
  console.log("inside verify token", req.headers.authorization);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

async function run() {
  try {
    const districtsCollection = client
      .db("bloodHopeDb")
      .collection("districts");
    const upazilasCollection = client.db("bloodHopeDb").collection("upazilas");
    const usersCollection = client.db("bloodHopeDb").collection("users");
    const donationRequestsCollection = client
      .db("bloodHopeDb")
      .collection("donationRequest");
    // Connect the client to the server
    await client.connect();

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_Secret_Key, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    app.get("/districts", async (req, res) => {
      const result = await districtsCollection.find().toArray();
      res.send(result);
    });
    app.get("/upazilas", async (req, res) => {
      const result = await upazilasCollection.find().toArray();
      res.send(result);
    });
    // to post a user
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });
    // to get all users
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    // to get one user
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };

      const result = await usersCollection.findOne(query);
      res.send(result);
    });
    // user update
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const userData = req.body;
      const updatedDoc = {
        $set: { ...userData },
      };
      const result = await usersCollection.updateOne(query, updatedDoc);
      res.send(result);
    });
    // donation request related

    // donation post
    app.post("/donation-requests", async (req, res) => {
      const donation = req.body;
      const result = await donationRequestsCollection.insertOne(donation);
      res.send(result);
    });
    // getting all donation requests
    app.get("/donation-requests", async (req, res) => {
      const result = await donationRequestsCollection.find().toArray();
      res.send(result);
    });
    // getting user donation requests
    // app.get("/donation-requests/:email", async (req, res) => {
    //   const email = req.params.email;
    //   const query = { requesterEmail: email };
    //   const result = await donationRequestsCollection.find(query).toArray();
    //   res.send(result);
    // });

    app.get("/donation-requests/:email", async (req, res) => {
      const email = req.params.email;

      // Extract query parameters for filtering and pagination
      const { status, page = 1, limit = 10 } = req.query;

      // Build the query object
      const query = { requesterEmail: email };
      if (status) {
        query.donationStatus = status;
      }

      try {
        // Get the total count of documents matching the query
        const total = await donationRequestsCollection.countDocuments(query);

        // Fetch the paginated results
        const result = await donationRequestsCollection
          .find(query)
          .skip((page - 1) * limit) // Skip documents for pagination
          .limit(parseInt(limit)) // Limit the number of documents returned
          .toArray();

        // Send response with paginated data
        res.send({
          total, // Total matching records
          page: parseInt(page), // Current page
          limit: parseInt(limit), // Items per page
          totalPages: Math.ceil(total / limit), // Total pages
          data: result, // Paginated data
        });
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch donation requests." });
      }
    });

    // Ping the deployment to confirm the connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error.message);
  } finally {
    // Optional: Close the connection if you don't need it persistently
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", async (req, res) => {
  res.send("my BloodHope server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
