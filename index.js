require("dotenv").config();
const express = require("express");
const cors = require("cors");

const port = process.env.PORT || 9000;
const app = express();
const stripe = require("stripe")(process.env.Payment_Secret_Key);
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
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.JWT_Secret_Key, (err, decoded) => {
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
    const blogsCollection = client.db("bloodHopeDb").collection("blogs");
    const fundingCollection = client.db("bloodHopeDb").collection("funding");
    const reviewCollection = client.db("bloodHopeDb").collection("reviews");
    // Connect the client to the server
    // await client.connect();

    // use verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    const verifyAdminOrVolunteer = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdminOrVolunteer =
        user?.role === "admin" || user?.role === "volunteer";
      if (!isAdminOrVolunteer) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

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
    // user related api

    // update a user role & status

    app.patch(
      "/user/role/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
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
      }
    );

    // get user role
    app.get("/users/role/:email", verifyToken, async (req, res) => {
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
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
    // total users data get in admin
    app.get("/total-users", verifyToken, verifyAdmin, async (req, res) => {
      const { status } = req.query;

      const query = {};
      if (status) {
        query.status = status; // Apply status filter if provided
      }

      const total = await usersCollection.countDocuments(query);
      res.send({ count: total });
    });
    // all user data get in admin route
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const { status, page = 1, limit = 2 } = req.query;

      // Ensure page and limit are valid numbers and positive
      const pageNum = Math.max(1, parseInt(page)); // Ensures page is at least 1
      const limitNum = Math.max(1, parseInt(limit)); // Ensures limit is at least 1

      const query = {};
      if (status) {
        query.status = status; // Apply status filter if provided
      }

      const skip = (pageNum - 1) * limitNum; // Calculate skip for pagination

      const data = await usersCollection
        .find(query)
        .skip(skip)
        .limit(limitNum)
        .toArray();

      res.send(data);
    });

    // to get one user
    app.get("/user/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };

      const result = await usersCollection.findOne(query);
      res.send(result);
    });
    // user update
    app.put("/user/:email", verifyToken, async (req, res) => {
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const email = req.params.email;
      const query = { email };
      const userData = req.body;
      const updatedDoc = {
        $set: { ...userData },
      };
      const result = await usersCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    // only donor data getting in public search
    app.get("/users/donor", async (req, res) => {
      const { bloodGroup, district, upazila } = req.query;

      // Construct the query filter based on the parameters
      const query = { role: "donor" };

      if (bloodGroup) {
        query.bloodGroup = bloodGroup;
      }
      if (district) {
        query.district = district;
      }
      if (upazila) {
        query.upazila = upazila;
      }

      try {
        const result = await usersCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to fetch donors." });
      }
    });

    // donation request related

    // donation post
    app.post("/donation-requests", verifyToken, async (req, res) => {
      const donation = req.body;
      const result = await donationRequestsCollection.insertOne(donation);
      res.send(result);
    });
    // getting all donation requests both in admin and volunteer route
    app.get(
      "/donation-requests",
      verifyToken,
      verifyAdminOrVolunteer,
      async (req, res) => {
        // Extract query parameters for filtering and pagination
        const { status, page = 1, limit = 10 } = req.query;
        const query = {};
        if (status) {
          query.donationStatus = status;
        }

        // Fetch the paginated results
        const result = await donationRequestsCollection
          .find(query)
          .skip((page - 1) * limit) // Skip documents for pagination
          .limit(parseInt(limit)) // Limit the number of documents returned
          .toArray();

        res.send(result);
      }
    );
    app.get("/all-donation-request", async (req, res) => {
      const result = await donationRequestsCollection.find().toArray();
      res.send(result);
    });

    // delete a donation request
    app.delete("/donation-request/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationRequestsCollection.deleteOne(query);
      res.send(result);
    });
    // donation request update work
    app.put("/donation-request/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const donationData = req.body;
      const updatedDoc = {
        $set: { ...donationData },
      };
      const result = await donationRequestsCollection.updateOne(
        query,
        updatedDoc
      );
      res.send(result);
    });

    // getting user donation requests

    app.get(
      "/total-donation-requests",
      verifyToken,
      verifyAdminOrVolunteer,
      async (req, res) => {
        const total = await donationRequestsCollection.estimatedDocumentCount();
        res.send({ count: parseInt(total) });
      }
    );
    app.get(
      "/total-donation-requests/:email",
      verifyToken,
      async (req, res) => {
        if (req.params.email !== req.decoded.email) {
          return res.status(403).send({ message: "forbidden access" });
        }
        const email = req.params.email;
        const { status } = req.query;

        const query = { requesterEmail: email };
        if (status) {
          query.donationStatus = status; // Apply status filter if provided
        }

        const total = await donationRequestsCollection.countDocuments(query);
        res.send({ count: total });
      }
    );

    app.get("/donation-requests/:email", verifyToken, async (req, res) => {
      // if (req.params.email !== req.decoded.email) {
      //   return res.status(403).send({ message: "forbidden access" });
      // }
      const email = req.params.email;
      const { status, page = 1, limit = 2 } = req.query;

      const query = { requesterEmail: email };
      if (status) {
        query.donationStatus = status; // Apply status filter if provided
      }

      const skip = (parseInt(page) - 1) * parseInt(limit); // Calculate skip for pagination
      const data = await donationRequestsCollection
        .find(query)
        .skip(skip)
        .limit(parseInt(limit))
        .toArray();

      res.send(data);
    });

    //   get single donation request
    app.get("/donation-request/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donationRequestsCollection.findOne(query);
      res.send(result);
    });
    // get only pending donation data is public
    app.get("/donation-request/status/:status", async (req, res) => {
      const status = req.params.status;
      const query = { donationStatus: status };
      const result = await donationRequestsCollection.find(query).toArray();
      res.send(result);
    });

    // update donation status
    app.patch("/donation-request/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const { status } = req.body;
      const updatedDoc = {
        $set: { donationStatus: status },
      };
      try {
        const result = await donationRequestsCollection.updateOne(
          query,
          updatedDoc
        );
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to update donation status." });
      }
    });

    app.get("/last-donation-requests/:email", verifyToken, async (req, res) => {
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
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
    app.get("/admin-stat/:role", verifyToken, async (req, res) => {
      const role = req.params.role;
      const query = { role: role };

      const totalUsers = await usersCollection.countDocuments(query);
      const totalRequests =
        await donationRequestsCollection.estimatedDocumentCount();
      res.send({ totalUsers, totalRequests });
    });

    // blogs related
    // post blog
    app.post(
      "/blogs",
      verifyToken,
      verifyAdminOrVolunteer,
      async (req, res) => {
        const blog = req.body;
        const result = await blogsCollection.insertOne(blog);
        res.send(result);
      }
    );
    // get all blog
    app.get("/blogs", verifyToken, verifyAdminOrVolunteer, async (req, res) => {
      const { status } = req.query;
      const query = {};
      if (status) {
        query.blogStatus = status;
      }
      const result = await blogsCollection.find(query).toArray();
      res.send(result);
    });
    // get single blog
    app.get("/blog/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await blogsCollection.findOne(query);
      res.send(result);
    });

    // update blogs status

    app.patch("/blog/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const { blogStatus } = req.body; // Ensure you use blogStatus here

      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: { blogStatus: blogStatus }, // Set the received blogStatus
      };
      try {
        const result = await blogsCollection.updateOne(query, updatedDoc);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: "Failed to update blog status" });
      }
    });

    // blog delete
    app.delete("/blog/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await blogsCollection.deleteOne(query);
      res.send(result);
    });
    // published blog getting route
    app.get("/blogs/status/:status", async (req, res) => {
      const status = req.params.status;
      const query = { blogStatus: status };
      const result = await blogsCollection.find(query).toArray();
      res.send(result);
    });

    // review get
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    // create payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { amount, currency } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).send({ error: "Invalid amount" });
      }

      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency,
          payment_method_types: ["card"],
        });
        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });
    // funding post
    app.post("/funding", async (req, res) => {
      const fundData = req.body;

      try {
        // Save data to the database (using a hypothetical `fundings` collection)
        const result = await fundingCollection.insertOne(fundData);

        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Internal server error" });
      }
    });
    // get all funds
    app.get("/funding", verifyToken, async (req, res) => {
      const result = await fundingCollection.find().toArray();
      res.send(result);
    });

    // Ping the deployment to confirm the connection
    // await client.db("admin").command({ ping: 1 });
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
