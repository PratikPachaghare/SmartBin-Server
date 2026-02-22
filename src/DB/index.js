import mongoose from "mongoose";
import {DB_NAME} from "../constants.js";

const connectDB = async ()=>{
    try{
        const connection_insta = await mongoose.connect(process.env.DB_KEY)
        console.log(`\n mongoDB connected !! DB HOST ${(await connection_insta.connection.host)}`)
    }
    catch(error){
        console.log("cnnection faild : ", error);
        throw error;
    }
}

export const connectdb =  connectDB;