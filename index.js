const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();
const port = process.env.PORT || 3000
const { MongoClient, ServerApiVersion } = require('mongodb');
//middleware to parse JSON bodies
app.use(express.json());
app.use(cors());




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
    const db=client.db("restaurantDB");
    const usersCollection=db.collection("users");
    const foodDishesCollection=db.collection("foodDishes");
    const bookTableCollection=db.collection("bookTable");
  //users api
  app.get('/users',async(req,res)=>{
    const users=await usersCollection.find().toArray();
    res.send(users);

  })
  app.post('/users',async(req,res)=>{
    const newUser=req.body;
    newUser.role="customer";
    newUser.createdAt=new Date();
    const email=newUser.email;
    const useExists=await usersCollection.findOne({email});

    if(useExists){
      return res.status(400).send({message:"User already exists"});
    }

    const result=await usersCollection.insertOne(newUser);
    res.send(result);
  })
  app.get('/users/:email',async(req,res)=>{
    const email=req.params.email;
    const user=await usersCollection.findOne({email});
    res.send(user);
    
  });
  //foodDishes api
  app.get('/foodDishes',async(req,res)=>{
    const foodDishes=await foodDishesCollection.find().toArray();
    res.send(foodDishes);
});
app.get('/latestFoodDishes',async(req,res)=>{
  const latestFoodDishes=await foodDishesCollection.find().sort({createdAt:-1}).limit(4).toArray();
  res.send(latestFoodDishes);
});
app.post('/foodDishes',async(req,res)=>{
    const newFoodDish=req.body;
    const result=await foodDishesCollection.insertOne(newFoodDish);
    res.send(result);
});

//bookTable api
app.get('/bookTable',async(req,res)=>{
     const bookings=await bookTableCollection.find().toArray();
     res.send(bookings);
})
app.post('/bookTable',async(res,req)=>{
  const newBooking=req.body;
  const result=await bookTableCollection.insertOne(newBooking);
  res.send(result);
})

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
