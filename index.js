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

    // update a user role & status

    app.patch("/user/role/:email", async (req, res) => {
      const email = req.params.email;
      const { role, status } = req.body;

      if (!role && !status) {
        return res
          .status(400)
          .send({ error: "No role or status provided for update." });
      }

      const query = { email };
      const updateDoc = {};

      if (role) updateDoc.role = role;
      if (status) updateDoc.status = status;

      try {
        const result = await usersCollection.updateOne(query, {
          $set: updateDoc,
        });
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to update user" });
      }
    });

    // get user role
    app.get("/users/role/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await usersCollection.findOne(query);
      res.send({ role: result?.role });
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

    app.get("/total-donation-requests/:email", async (req, res) => {
      const email = req.params.email;
      const query = { requesterEmail: email };
      const total = await donationRequestsCollection.countDocuments(query);
      res.send({ count: parseInt(total) });
    });
    app.get("/donation-requests/:email", async (req, res) => {
      const email = req.params.email;

      // Extract query parameters for filtering and pagination
      const { status, page = 1, limit = 10 } = req.query;

      // Build the query object
      const query = { requesterEmail: email };
      if (status) {
        query.donationStatus = status;
      }

      // Fetch the paginated results
      const result = await donationRequestsCollection
        .find(query)
        .skip((page - 1) * limit) // Skip documents for pagination
        .limit(parseInt(limit)) // Limit the number of documents returned
        .toArray();

      // Send response with paginated data
      res.send(result);
    });

    app.get("/last-donation-requests/:email", async (req, res) => {
      const email = req.params.email;
      const query = { requesterEmail: email };
      const result = await donationRequestsCollection
        .find(query)
        .sort({ _id: -1 }) // Sort by _id in descending order (latest first)
        .limit(3) // Limit to the last 3 documents
        .toArray();

      res.send(result); // Send the last 3 donation requests
    });

    // admin stat
    app.get("/admin-stat", async (req, res) => {
      const totalUsers = await usersCollection.estimatedDocumentCount();
      const totalRequests =
        await donationRequestsCollection.estimatedDocumentCount();
      res.send({ totalUsers, totalRequests });
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
