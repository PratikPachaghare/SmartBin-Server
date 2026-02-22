// utils/cloudinary.js
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// Config (Same as yours)
cloudinary.config({ 
    cloud_name: process.env.CLOUDINERY_NAME, 
    api_key: process.env.CLOUDINERY_API_KEY, 
    api_secret: process.env.CLOUDINERY_API_SECRET
});

const uploadOnCloudinery = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        
        // 1. Upload logic
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        });

        // ✅ IMPORTANT: Success hone ke baad bhi local file delete karo
        fs.unlinkSync(localFilePath); 
        
        console.log("File uploaded to Cloudinary:", response.url);
        return response;

    } catch (error) {
        // Error case: Safely delete local file
        if (fs.existsSync(localFilePath)) {
             fs.unlinkSync(localFilePath);
        }
        return null;
    }
}

export { uploadOnCloudinery };