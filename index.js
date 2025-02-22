require("dotenv").config();
const express = require("express");
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 9000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});

const corsOption = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
};

app.use(cors(corsOption));
app.use(express.json());
const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@ratul.gtek0.mongodb.net/?retryWrites=true&w=majority&appName=Ratul`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const database = client.db("taskify");
    const usersCollection = database.collection("users");
    const tasksCollection = database.collection("tasks");
    app.get("/", (req, res) => {
      res.send("This is taskify server!");
    });
    app.post("/tasks", async (req, res) => {
      const data = req;
    });

    app.post("/users", async (req, res) => {
      const { email, name } = req.body;
      const user = { email, name };
      const query = { email: email };
      const isExist = await usersCollection.findOne(query);
      console.log(isExist);
      if (isExist) return;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
