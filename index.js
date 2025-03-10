require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { connectDB, getDb } = require("./db");
const { ObjectId } = require("mongodb");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 9000;

const corsOption = {
  origin: ["http://localhost:5173", "https://taskify-client-sooty.vercel.app"],
};

const io = new Server(server, {
  cors: corsOption,
});

app.use(cors(corsOption));
app.use(express.json());

let tasksCollection;
let usersCollection;

// **Ensure DB Connection Before Starting Server**
async function startServer() {
  await connectDB(); // Wait for DB connection
  const db = getDb();
  tasksCollection = await db.collection("tasks");
  usersCollection = await db.collection("users");
  if (!tasksCollection) {
    console.error("Failed to initialize tasksCollection");
    process.exit(1);
  }

  console.log("Tasks collection initialized");

  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}.`);
  });
}

startServer();

app.get("/tasks", async (req, res) => {
  if (!tasksCollection) return res.status(500);

  try {
    const result = await tasksCollection.find().toArray();
    res.send(result);
  } catch (err) {
    res.status(500);
  }
});

app.get("/", (req, res) => {
  res.send("Welcome to taskify server!");
});

// **Socket.io Events**
io.on("connection", (socket) => {
  // Ensure tasksCollection is initialized before handling events
  if (!tasksCollection) {
    console.error("Database not initialized yet");
    return;
  }

  // **New Task Creation**
  socket.on("task-creation", async (task) => {
    try {
      const result = await tasksCollection.insertOne(task);
      const newTask = { _id: result.insertedId, ...task };
      io.emit("newTask", newTask);
    } catch (error) {
      console.error("Error inserting task:", error);
    }
  });

  // **User Creation**
  socket.on("users-creation", async (user) => {
    console.log("User:", user);
    try {
      const { email, name } = user;
      const isExist = await usersCollection.findOne({ email });

      if (isExist) {
        console.log("User already exists");
        return;
      }

      await usersCollection.insertOne(user);
      console.log("New user added");
    } catch (err) {
      console.error("Error adding user:", err);
    }
  });

  // **Get Tasks**
  socket.on("get-tasks", async (userEmail) => {
    try {
      const tasks = await tasksCollection
        .find({ addedBy: userEmail })
        .toArray();

      // socket.emit("updatedTasks", tasks); // Emit only to the requesting client
      socket.emit("userTasks", tasks);
    } catch (err) {
      console.error("Error fetching tasks:", err);
    }
  });

  // **Delete Tasks**
  socket.on("task-delete", async ({ id }) => {
    const query = { _id: new ObjectId(id) };

    const deletedTask = await tasksCollection.findOne(query);
    const result = await tasksCollection.deleteOne(query);
    socket.emit("task-deleted", deletedTask);
  });

  //** task update */
  socket.on("task-update", async ({ id, title }) => {
    const query = { _id: new ObjectId(id) };
    const updatedDoc = {
      $set: {
        title: title,
      },
    };

    const result = await tasksCollection.updateOne(query, updatedDoc);
    const task = await tasksCollection.findOne(query);

    socket.emit("updated-tasks", task);
  });

  //reorder items
  // Reorder items
  socket.on("reorder-items", async ({ email, updatedItems }) => {
    try {
      for (const task of updatedItems) {
        const query = { _id: new ObjectId(task._id), addedBy: email };
        const update = { $set: { order: task.order } };
        await tasksCollection.updateOne(query, update);
      }

      // Fetch and emit only the updated user's tasks
      const updatedTasks = await tasksCollection
        .find({ addedBy: email })
        .sort({ order: 1 })
        .toArray();
      socket.emit("reordered-tasks", { updatedTasks });
    } catch (err) {
      console.error("Error updating task order:", err);
    }
  });

  // Update task category
  socket.on("update-task-category", async (task) => {
    const query = { _id: new ObjectId(task._id) };
    const updatedDoc = {
      $set: {
        category: task.category,
        order: task.order, // Ensure order is updated when moving between columns
      },
    };
    try {
      const result = await tasksCollection.updateOne(query, updatedDoc);
    } catch (err) {
      console.error("Error updating task category:", err);
    }
  });
  socket.on("disconnect", () => {
    console.log("A user has disconnected");
  });
});
