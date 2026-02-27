import fs from 'fs';
import path from 'path';
import WasteReport from '../models/WasteReport.js';
import PublicUser from '../models/PublicUser.js';

// 👉 IMPORT YOUR CLOUDINARY UTILITY HERE
// Adjust the path '../utils/cloudinary.js' to exactly where your file is located
import { uploadOnCloudinery } from '../utils/coudnary.js'; 

export const loginOrRegister = async (req, res) => {
  // ... (Your existing loginOrRegister code remains exactly the same)
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

    let user = await PublicUser.findOne({ username });
    if (user) {
      const isMatch = await user.comparePassword(password);
      if (!isMatch) return res.status(401).json({ error: 'Incorrect password for existing user' });
      return res.status(200).json({ message: 'Login successful', userId: user._id, username: user.username });
    } else {
      user = new PublicUser({ username, password });
      await user.save();
      return res.status(201).json({ message: 'Account created and logged in automatically', userId: user._id, username: user.username });
    }
  } catch (error) {
    console.error('Auth Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Function 1: Store Report Data (UPDATED FOR CLOUDINARY)
 */
export const uploadAndStoreReport = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload an image' });
    }

    const { userId, latitude, longitude } = req.body;

    if (!userId || !latitude || !longitude) {
      // Clean up the uploaded file if validation fails
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'User ID and location data are required' });
    }

    // 1. Upload the image to Cloudinary
    const cloudinaryResponse = await uploadOnCloudinery(req.file.path);

    // 2. Check if upload failed
    if (!cloudinaryResponse) {
      return res.status(500).json({ error: 'Failed to upload image to Cloudinary' });
    }

    // 3. Extract the secure URL from Cloudinary
    const imageUrl = cloudinaryResponse.secure_url;

    // 4. Save to Database
    const newReport = new WasteReport({
      userId,
      imageUrl, // This is now the live Cloudinary URL
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      },
      status: 'pending',
    });

    const savedReport = await newReport.save();

    // Trigger AI verification in the background (fire and forget)
    sendForVerification(savedReport._id).catch(console.error);

    res.status(201).json({
      message: 'Report created successfully, pending verification',
      reportId: savedReport._id,
      imageUrl, // Sending the Cloudinary URL back to the frontend
    });
  } catch (error) {
    console.error('Error saving report:', error);
    // Cleanup on unexpected server error (if file still exists)
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path); 
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Function 2: Send to AI Model Verification
 * Automatically called after a successful upload.
 */
export const sendForVerification = async (reportId) => {
  try {
    const report = await WasteReport.findById(reportId);
    if (!report) return;

    // NOTE: Because your image is now on Cloudinary, you no longer read it from the local disk.
    // In a real scenario, you would send the Cloudinary URL to your Python/Flask AI service:
    /*
    const response = await fetch('YOUR_AI_SERVICE_URL/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: report.imageUrl }) 
    });
    const result = await response.json();
    */

    // MOCKING the Garbage/Trash AI Model response:
    const mockModelResponse = {
      detected: true, 
      confidence: 0.88, 
    };

    report.modelResult = {
      garbageStrash: {
        detected: mockModelResponse.detected,
        confidence: mockModelResponse.confidence,
      },
    };

    await report.save();
    console.log(`Report ${reportId} processed by AI. Ready for worker.`);

  } catch (err) {
    console.error(`Error in AI verification for report ${reportId}:`, err);
  }
};

/**
 * Function 3: Final Worker Verification
 */
export const verifyReportByWorker = async (req, res) => {
  try {
    const { reportId, workerId, decision, comments } = req.body;

    if (!reportId || !workerId || !decision) {
      return res.status(400).json({ error: 'Report ID, Worker ID, and decision are required.' });
    }

    if (!['valid', 'invalid'].includes(decision)) {
      return res.status(400).json({ error: 'Decision must be "valid" or "invalid".' });
    }

    const report = await WasteReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    report.status = decision;
    report.workerFeedback = {
      workerId,
      decision,
      comments: comments || '',
      verifiedAt: new Date(),
    };

    await report.save();

    res.status(200).json({ 
      message: 'Verification complete.', 
      finalStatus: report.status 
    });
  } catch (err) {
    console.error('Error during worker verification:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getPendingReports = async (req, res) => {
  try {
    const pendingReports = await WasteReport.find({ status: 'pending' }).sort({ createdAt: 1 });
    res.status(200).json({ reports: pendingReports });
  } catch (error) {
    console.error('Error fetching pending reports:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


export const getUserReports = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Find all reports by this user, newest first
    const userReports = await WasteReport.find({ userId }).sort({ createdAt: -1 });
    
    // Optional: Calculate real points on the backend to send to the frontend
    const validReports = userReports.filter(report => report.status === 'valid').length;
    const invalidReports = userReports.filter(report => report.status === 'invalid').length;
    
    // Let's say a valid report gives 10 points, and an invalid deducts 10 points
    const totalPoints = Math.max(0, (validReports * 10) - (invalidReports * 10));

    res.status(200).json({ 
      reports: userReports,
      stats: {
        totalUploads: userReports.length,
        validReports,
        invalidReports,
        totalPoints
      }
    });
  } catch (error) {
    console.error('Error fetching user reports:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};