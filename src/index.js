import dotenv from "dotenv";
import { server } from "./app.js"; 
import { connectdb } from "./DB/index.js";

// Load environment variables
dotenv.config({
    path: '../.env' // Path check karein agar file root mein hai
});

const PORT = process.env.PORT || 8000;

connectdb()

.then(() => {
 
    
    server.listen(PORT, () => {
        console.log(`🚀 Server running on port: ${PORT}`);
        console.log(`🔌 Socket.io is initialized!`);
    });
})
.catch((error) => {
    console.log(`❌ MongoDB connection error: `, error);
});