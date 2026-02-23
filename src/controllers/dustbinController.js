import BinHistory from '../models/BinHistory.js';
import Dustbin from '../models/Dustbin.js';

export const getMapDustbins = async (req, res) => {
  try {
    const { north, south, east, west } = req.query;

    // Validate that boundaries are provided
    if (!north || !south || !east || !west) {
      // If no boundaries, return the first 50 active bins as default
      const defaultBins = await Dustbin.find({ isActive: true }).limit(50);
      return res.status(200).json(defaultBins);
    }

    /** * Find dustbins where:
     * lat is between south and north
     * lng is between west and east
     */
    const dustbins = await Dustbin.find({
      isActive: true,
      'location.lat': { $gte: parseFloat(south), $lte: parseFloat(north) },
      'location.lng': { $gte: parseFloat(west), $lte: parseFloat(east) }
    }).limit(100); // Limit to 100 to maintain performance

    res.status(200).json(dustbins);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching map data', error: error.message });
  }
};



export const createDustbin = async (req, res) => {
  try {
    const { name, area, size, lat, lng } = req.body;

    // 1. Basic Validation: Zaroori fields check karein
    if (!name || !lat || !lng) {
      return res.status(400).json({ 
        message: 'Name, Latitude aur Longitude zaroori hain.' 
      });
    }

    // 2. Naya Dustbin object banayein
    const newDustbin = new Dustbin({
      name,
      area,
      size,
      location: {
        lat: parseFloat(lat),
        lng: parseFloat(lng)
      },
      currentLevel: 0, // Shuruat mein level 0 rahega
      isActive: true    // By default active
    });

    // 3. Database mein save karein
    const savedDustbin = await newDustbin.save();

    res.status(201).json({
      message: 'Dustbin successfully add ho gaya!',
      dustbin: savedDustbin
    });

  } catch (error) {
    res.status(500).json({ 
      message: 'Server Error: Dustbin add nahi ho paya.', 
      error: error.message 
    });
  }
};


export const createBulkDustbins = async (req, res) => {
  try {
    const dustbinsList = req.body; // Maan lijiye ye ek array hai
    // 1. Validation: Check karein ki ye array hai ya nahi
    if (!Array.isArray(dustbinsList) || dustbinsList.length === 0) {
      return res.status(400).json({ 
        message: 'Kripya dustbins ki ek list (array) bhejein.' 
      });
    }

    // 2. Data Formatting (Har bin ke liye default fields check karein)
    const formattedBins = dustbinsList.map(bin => ({
      name: bin.name,
      area: bin.area,
      location_type: bin.location_type || 'Residential', // Aapka naya model field
      size: bin.size || 'Medium',
      location: {
        lat: parseFloat(bin.lat),
        lng: parseFloat(bin.lng)
      },
      currentLevel: 0,
      isActive: true
    }));

    // 3. insertMany ka use karke bulk save karein
    const savedBins = await Dustbin.insertMany(formattedBins);

    res.status(201).json({
      success: true,
      message: `${savedBins.length} Dustbins successfully add ho gaye!`,
      data: savedBins
    });

  } catch (error) {
    res.status(500).json({ 
      message: 'Bulk insert mein error aaya.', 
      error: error.message 
    });
  }
};


export const updateDustbinLevel = async (req, res) => {
  try {
    const { bin_id, currentLevel } = req.body;

    if (!bin_id || currentLevel === undefined) {
      return res.status(400).json({ message: "bin_id aur currentLevel zaroori hain." });
    }

    const binProfile = await Dustbin.findById(bin_id);
    if (!binProfile) return res.status(404).json({ message: "Dustbin nahi mila." });

    // 1. Fetch Latest 30 entries to calculate Moving Average (Adaptive Learning)
    const historyLogs = await BinHistory.find({ bin_id })
      .sort({ timestamp: -1 })
      .limit(30);

    const currentTime = new Date();
    let adaptiveHourRate = 0; // Avg percentage per hour
    let hoursToFull = 0;

    if (historyLogs.length > 1) {
      // 2. Calculate Average Fill Rate from history
      let totalRate = 0;
      let count = 0;

      for (let i = 0; i < historyLogs.length - 1; i++) {
        const curr = historyLogs[i];
        const prev = historyLogs[i + 1];
        
        const timeDiff = (new Date(curr.timestamp) - new Date(prev.timestamp)) / (1000 * 60 * 60);
        const levelDiff = curr.fill_percent - prev.fill_percent;

        // Hum sirf wahi data lenge jahan level badha hai (Filling phase)
        if (timeDiff > 0 && levelDiff > 0) {
          totalRate += (levelDiff / timeDiff);
          count++;
        }
      }

      // 3. Adaptive Rate (Agar data hai toh avg nikalo, nahi toh purana default)
      adaptiveHourRate = count > 0 ? (totalRate / count) : 1.5; // Default 1.5% per hour if no filling data
    } else {
      adaptiveHourRate = 2.0; // Very first entry default
    }

    // 4. Current Prediction Logic
    const lastRecord = historyLogs[0];
    if (lastRecord && currentLevel > lastRecord.fill_percent) {
      // Current fast-track prediction (Real-time update)
      const timeDiff = (currentTime - new Date(lastRecord.timestamp)) / (1000 * 60 * 60);
      const currentRate = (currentLevel - lastRecord.fill_percent) / timeDiff;
      
      // We take a weighted average of Current Rate and Historical Adaptive Rate
      const finalRate = (currentRate * 0.7) + (adaptiveHourRate * 0.3);
      hoursToFull = (100 - currentLevel) / finalRate;
    } else {
      // Agar bin khali hua hai ya level same hai, toh Historical Average use karo
      hoursToFull = (100 - currentLevel) / adaptiveHourRate;
    }

    // 5. Weekend & Data Storage
    const isWeekend = (currentTime.getDay() === 6 || currentTime.getDay() === 0) ? 1 : 0;

    await BinHistory.create({
      bin_id,
      timestamp: currentTime,
      location_type: binProfile.location_type,
      fill_percent: currentLevel,
      is_weekend: isWeekend,
      hours_to_full: Math.max(0, hoursToFull).toFixed(2)
    });

    // 6. Update Master Table with new dynamic priority
    const priority = hoursToFull < 6 ? 10 : (hoursToFull < 15 ? 5 : 1);
    
    await Dustbin.findByIdAndUpdate(bin_id, {
      currentLevel,
      lastSeenAt: currentTime,
      priority_score: priority,
      // Optional: Store adaptive rate in master to show on dashboard
      Hour_Fill_Level: `${adaptiveHourRate.toFixed(2)} %/hr` 
    });

    res.status(200).json({
      success: true,
      prediction: hoursToFull.toFixed(2),
      avg_rate: adaptiveHourRate.toFixed(2)
    });

  } catch (error) {
    console.error("Adaptive Update Error:", error);
    res.status(500).json({ message: "Error in adaptive processing" });
  }
};

import User from '../models/user.model.js';
// Backend Controller Update
export const collectBin = async (req, res) => {
  try {
    const { bin_id } = req.body; // Params ki jagah Body use karein
    const workerId = req.user.id; 

    const updatedBin = await Dustbin.findByIdAndUpdate(
      bin_id,
      { currentLevel: 0, status: 'Empty', lastCollectedAt: new Date() },
      { new: true }
    );

    if (!updatedBin) return res.status(404).json({ success: false, message: "Bin not found" });

    // Worker performance increment
    await User.findByIdAndUpdate(workerId, { $inc: { tasksCompleted: 1 } });

    res.status(200).json({ success: true, message: "Level reset to 0", currentLevel: 0 });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};