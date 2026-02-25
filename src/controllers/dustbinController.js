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
    // 1. Request se saare fields nikalna
    const { name, area, location_type, size, sizeCM, lat, lng } = req.body;
    // 2. Validation: Zaroori fields check karein
    if (!name || !area || !lat || !lng) {
      return res.status(400).json({ 
        message: 'Name, Area, Latitude aur Longitude zaroori hain.' 
      });
    }

    // 3. Naya Dustbin object banayein (schema ke mutabiq)
    const newDustbin = new Dustbin({
      name,
      area,
      location_type: location_type || 'Residential', // Default fallback
      size: size || 'Medium',                       // Default fallback
      sizeCM: sizeCM ? Number(sizeCM) : 30,         // String ko Number mein convert karein
      location: {
        lat: parseFloat(lat),
        lng: parseFloat(lng)
      }
    });

    // 4. Database mein save karein
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
    const { bin_id, currentLevel } = req.body; // currentLevel yahan Arduino se aane wala 'CM' hai
    console.log("Received update for Bin ID:", bin_id, "with Sensor CM:", currentLevel);
    if (!bin_id || currentLevel === undefined) {
      return res.status(400).json({ message: "bin_id aur currentLevel (CM) zaroori hain." });
    }

    // 1. Dustbin ka data fetch karein taaki humein 'sizeCM' mil sake
    const binProfile = await Dustbin.findById(bin_id);
    if (!binProfile) return res.status(404).json({ message: "Dustbin nahi mila." });

    // 2. CM se Percentage calculate karein
    // Formula: (Total Height - Khali Jagah) / Total Height * 100
    const totalHeight = binProfile.sizeCM || 30; // Default 30cm agar DB mein na ho
    let calculatedFillPercent = ((totalHeight - currentLevel) / totalHeight) * 100;

    // Constraints: 0 se niche na jaye aur 100 se upar na jaye
    calculatedFillPercent = Math.max(0, Math.min(100, calculatedFillPercent));
    
    console.log(`Bin ID: ${bin_id} | Sensor CM: ${currentLevel} | Calculated Fill: ${calculatedFillPercent.toFixed(2)}%`);
    // return res.status(200).json({
    //   success: true,
    //   currentLevelPercent: calculatedFillPercent.toFixed(2)
    // });
    // --- Aapka Adaptive Logic Yahan Se Shuru Hota Hai ---
    
    // 3. Fetch History (Use calculatedFillPercent instead of raw currentLevel)
    const historyLogs = await BinHistory.find({ bin_id })
      .sort({ timestamp: -1 })
      .limit(30);

    const currentTime = new Date();
    let adaptiveHourRate = 0;
    let hoursToFull = 0;

    if (historyLogs.length > 1) {
      let totalRate = 0;
      let count = 0;

      for (let i = 0; i < historyLogs.length - 1; i++) {
        const curr = historyLogs[i];
        const prev = historyLogs[i + 1];
        
        const timeDiff = (new Date(curr.timestamp) - new Date(prev.timestamp)) / (1000 * 60 * 60);
        const levelDiff = curr.fill_percent - prev.fill_percent;

        if (timeDiff > 0 && levelDiff > 0) {
          totalRate += (levelDiff / timeDiff);
          count++;
        }
      }
      adaptiveHourRate = count > 0 ? (totalRate / count) : 1.5;
    } else {
      adaptiveHourRate = 2.0; 
    }

    // 4. Prediction using Calculated Percentage
    const lastRecord = historyLogs[0];
    if (lastRecord && calculatedFillPercent > lastRecord.fill_percent) {
      const timeDiff = (currentTime - new Date(lastRecord.timestamp)) / (1000 * 60 * 60);
      const currentRate = (calculatedFillPercent - lastRecord.fill_percent) / timeDiff;
      
      const finalRate = (currentRate * 0.7) + (adaptiveHourRate * 0.3);
      hoursToFull = (100 - calculatedFillPercent) / (finalRate || 0.1);
    } else {
      hoursToFull = (100 - calculatedFillPercent) / (adaptiveHourRate || 0.1);
    }

    // 5. Data Save Karein
    const isWeekend = (currentTime.getDay() === 6 || currentTime.getDay() === 0) ? 1 : 0;

    await BinHistory.create({
      bin_id,
      timestamp: currentTime,
      location_type: binProfile.location_type,
      fill_percent: calculatedFillPercent.toFixed(2), // Save percentage
      is_weekend: isWeekend,
      hours_to_full: Math.max(0, hoursToFull).toFixed(2)
    });

    // 6. Master Table Update
    const priority = hoursToFull < 6 ? 10 : (hoursToFull < 15 ? 5 : 1);
    
    await Dustbin.findByIdAndUpdate(bin_id, {
      currentLevel: calculatedFillPercent.toFixed(2), // Save percentage here too
      lastSeenAt: currentTime,
      priority_score: priority,
      Hour_Fill_Level: `${adaptiveHourRate.toFixed(2)} %/hr` 
    });

    res.status(200).json({
      success: true,
      currentLevelPercent: calculatedFillPercent.toFixed(2),
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



export const getCityBins = async (req, res) => {
  try {
    const { area } = req.query; // Area name extracted from query string
    let query = { isActive: true };

    // Agar frontend se "area" bheja gaya hai, toh query filter karein
    if (area) {
      // Use regex for case-insensitive matching
      query.area = { $regex: new RegExp(`^${area}$`, 'i') };
    }

    const dustbins = await Dustbin.find(query)
      .sort({ currentLevel: -1 }) // Show full bins first
      .limit(500); // Prevent crashing if there are thousands of bins

    res.status(200).json({
      success: true,
      count: dustbins.length,
      data: dustbins
    });

  } catch (error) {
    console.error("Error in getCityBins:", error);
    res.status(500).json({ 
      success: false, 
      message: 'Bins fetch karne mein error aaya.', 
      error: error.message 
    });
  }
};