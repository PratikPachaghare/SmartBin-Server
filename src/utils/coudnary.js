// utils/cloudinary.js
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

const CLOUDINERY_CLOUD_NAME = 'dncz7an76';
const CLOUDINERY_API_KEY = 721857556485297;
const CLOUDINERY_SECREAT_KEY = '6bmya-iqhA-ZP4nNLEqrVPnrySY';

// Config (Same as yours)
cloudinary.config({ 
    cloud_name: CLOUDINERY_CLOUD_NAME, 
    api_key: CLOUDINERY_API_KEY, 
    api_secret: CLOUDINERY_SECREAT_KEY
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
        console.error("Cloudinary Upload Error:", error);
        // Error case: Safely delete local file
        if (fs.existsSync(localFilePath)) {
             fs.unlinkSync(localFilePath);
        }
        return null;
    }
}

export { uploadOnCloudinery };