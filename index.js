const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 3000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
//middleware to parse JSON bodies
app.use(express.json());
app.use(cors());


const { parse, addMinutes, isBefore, isAfter } = require('date-fns');


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.cerdjzv.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const db = client.db("restaurantDB");
    const usersCollection = db.collection("users");
    const foodDishesCollection = db.collection("foodDishes");
    const bookTableCollection = db.collection("bookTable");
    const restaurantApplication = db.collection('restaurantApplications')
    const restaurantLayoutCollection = db.collection("restaurantLayouts");
    //users api
    app.get('/users', async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);

    })
    app.post('/users', async (req, res) => {
      const newUser = req.body;
      newUser.role = "user";
      newUser.createdAt = new Date();
      const email = newUser.email;
      const useExists = await usersCollection.findOne({ email });

      if (useExists) {
        return res.status(400).send({ message: "User already exists" });
      }

      const result = await usersCollection.insertOne(newUser);
      res.send(result);
    })
    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const user = await usersCollection.findOne({ email });
      res.send(user);

    });
    app.patch('/users/role/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const { role } = req.body;

        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: { role: role }
        };

        const result = await usersCollection.updateOne(filter, updateDoc);

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: 'User not found' });
        }

        res.send({
          message: 'User role updated successfully',
          result
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    app.patch('/users/:email', async (req, res) => {
      try {
        const email = req.params.email;
        const role = req.body.role;

        if (!role) {
          return res.status(400).send({ message: 'Role is required' });
        }

        const result = await usersCollection.updateOne(
          { email },
          { $set: { role } }
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: 'User not found' });
        }

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });

    // Delete User API (Admin Only)
    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);


      res.send(result);
    });
    // user-End



    //foodDishes api
    app.get('/foodDishes', async (req, res) => {
      const foodDishes = await foodDishesCollection.find().toArray();
      res.send(foodDishes);
    });
    app.get('/foodDishes/:id', async (req, res) => {
      const id = req.params.id;


      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ error: "Invalid ID format" });
      }

      try {
        const foodDish = await foodDishesCollection.findOne({ _id: new ObjectId(id) });

        if (!foodDish) {
          return res.status(404).send({ message: "Food dish not found" });
        }

        res.send(foodDish);
      } catch (error) {
        console.error("Error fetching food dish:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });
    app.get('/foodDishes/user/:email', async (req, res) => {
      const email = req.params.email;

      const foodDishes = await foodDishesCollection.find({ email }).toArray();
      res.send(foodDishes);
    });

    app.get('/latestFoodDishes', async (req, res) => {
      const latestFoodDishes = await foodDishesCollection.find().sort({ createdAt: -1 }).limit(4).toArray();
      res.send(latestFoodDishes);
    });
    app.post('/foodDishes', async (req, res) => {
      const newFoodDish = req.body;
      const result = await foodDishesCollection.insertOne(newFoodDish);
      res.send(result);
    });
    app.patch('/foodDishes/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      // Define what fields should be updated
      const updatedDoc = {
        $set: {
          title: item.title,
          category: item.category,
          price: item.price,
          image: item.image
        }
      }

      const result = await foodDishesCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });
    app.delete('/foodDishes/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await foodDishesCollection.deleteOne(query);
      res.send(result);
    })
    // food end


    //bookTable api
    app.get('/bookTable', async (req, res) => {
      let query = {};

      // ১. URL থেকে ইমেইলটা ধরুন
      if (req.query.customerEmail) {
        query = { customerEmail: req.query.customerEmail };
      }

      // ২. সেই query দিয়ে ডাটাবেসে খুঁজুন
      const result = await bookTableCollection.find(query).sort({ createdAt: -1 }).toArray();
      res.send(result);
    });

    app.post('/bookTable', async (req, res) => {
      try {
        const booking = req.body;

        const {
          restaurantEmail,
          date,
          time,          // "18:00"
          tableType,     // "2-seat" / "4-seat"
          duration       // 90
        } = booking;

        // Validation
        if (!restaurantEmail || !date || !time || !tableType) {
          return res.status(400).send({ message: 'Missing required booking data' });
        }

        /* -------------------------------
           1. Load restaurant layout
        -------------------------------- */
        // FIXED: restaurantLayoutsCollection -> restaurantLayoutCollection
        const layout = await restaurantLayoutCollection.findOne({
          email: restaurantEmail
        });

        if (!layout) {
          return res.status(404).send({ message: 'Restaurant layout not found' });
        }

        const totalTablesOfType = layout.tables.filter(
          t => t.type === tableType
        ).length;

        if (totalTablesOfType === 0) {
          return res.status(400).send({ message: 'No table available for this type' });
        }

        /* -------------------------------
           2. Find existing bookings
        -------------------------------- */
        // FIXED: bookingsCollection -> bookTableCollection
        const existingBookings = await bookTableCollection.find({
          restaurantEmail,
          date,
          tableType,
          status: { $ne: 'cancelled' }
        }).toArray();

        /* -------------------------------
           3. Overlap logic
        -------------------------------- */
        // date-fns ফাংশনগুলো ব্যবহার করে সময় চেক করা
        const slotStart = parse(time, 'HH:mm', new Date());
        const slotEnd = addMinutes(slotStart, duration || 90);

        const overlappingBookings = existingBookings.filter(b => {
          const bStart = parse(b.time, 'HH:mm', new Date());
          const bEnd = addMinutes(bStart, b.duration || 90);

          // চেক করা হচ্ছে নতুন স্লটটি আগের বুকিংয়ের সময়ের মধ্যে পড়ছে কিনা
          return isBefore(slotStart, bEnd) && isAfter(slotEnd, bStart);
        });

        if (overlappingBookings.length >= totalTablesOfType) {
          return res.status(409).send({
            message: 'Selected time slot is fully booked'
          });
        }

        /* -------------------------------
           4. Insert booking
        -------------------------------- */
        // FIXED: bookingsCollection -> bookTableCollection
        const result = await bookTableCollection.insertOne({
          ...booking,
          createdAt: new Date(),
          status: 'pending'
        });

        res.send({
          success: true,
          insertedId: result.insertedId
        });

      } catch (error) {
        console.error('Booking error:', error);
        res.status(500).send({
          message: 'Failed to create booking',
          error: error.message
        });
      }
    });

    app.patch('/bookTable/:id', async (req, res) => {
      const id = req.params.id;
      const { status } = req.body;

      const query = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          status: status,
          cancelledAt: new Date()
        }
      };

      const result = await bookTableCollection.updateOne(query, updateDoc);

      res.send(result);
    });


    // Get Bookings (Filter by restaurantEmail if provided)


    app.get('/bookTable', async (req, res) => {
      const restaurantEmail = req.query.restaurantEmail;
      let query = {};

      if (restaurantEmail) {
        query = { restaurantEmail: restaurantEmail };
      }

      const bookings = await bookTableCollection.find(query).sort({ createdAt: -1 }).toArray();
      res.send(bookings);
    });




    // Delete/Reject Booking API
    app.delete('/bookTable/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookTableCollection.deleteOne(query);
      res.send(result);
    });

    // book oder end



    //RESTURENT APLICATION
    app.post('/restaurantApplications', async (req, res) => {
      try {
        const restaurantApplications = req.body;
        const existingApplication = await restaurantApplication.findOne({
          email: restaurantApplications.email,
        })
        if (existingApplication) {
          return res.status(400).send({ message: 'You have already submitted an application.' })
        }
        const result = await restaurantApplication.insertOne(restaurantApplications);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: 'Internal Server Error' });
      }
    });
    app.get('/restaurantApplications/:email', async (req, res) => {
      const email = req.params.email;
      const result = await restaurantApplication.findOne({ email });
      res.send(result);
    })
    app.get('/restaurantApplications', async (req, res) => {
      const result = await restaurantApplication.find().toArray();
      res.send(result);
    })


    // Delete User API (Admin Only)
    app.delete('/restaurantApplications/:id', async (req, res) => {
      const id = req.params.id;


      const query = { _id: new ObjectId(id) };

      const result = await usersCollection.deleteOne(query);


      res.send(result);
    });
    // ---------------------------------------------------------
    // RESTAURANT LAYOUT MANAGEMENT APIs (No Token)
    // ---------------------------------------------------------

    // 1. GET Request: ডাটা দেখার জন্য
    app.get('/restaurant/layout', async (req, res) => {
      const result = await restaurantLayoutCollection.find().toArray();
      res.send(result)
    })
    app.get('/restaurant/layout/:email', async (req, res) => {
      try {
        const email = req.params.email;

        const query = { email: email };
        const result = await restaurantLayoutCollection.findOne(query);

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to fetch layout data" });
      }
    });

    app.patch('/restaurant/update-layout/:email', async (req, res) => {
      try {
        const email = req.params.email;
        const layoutData = req.body;

        const filter = { email: email };
        const options = { upsert: true };

        const updateDoc = {
          $set: {
            booking_duration: layoutData.booking_duration,
            tables: layoutData.tables,
            email: email
          }
        };

        const result = await restaurantLayoutCollection.updateOne(filter, updateDoc, options);
        res.send(result);

      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to update layout" });
      }
    });


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Restaurant is shafting!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
