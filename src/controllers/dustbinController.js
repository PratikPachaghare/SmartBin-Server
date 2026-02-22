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

    // 1. Validation: Check karein data sahi hai ya nahi
    if (!bin_id || currentLevel === undefined) {
      return res.status(400).json({ message: "bin_id aur currentLevel zaroori hain." });
    }

    // 2. Database mein update karein
    const bin = await Dustbin.findByIdAndUpdate(
      bin_id,
      { 
        currentLevel: currentLevel,
        lastSeenAt: Date.now() 
      },
      { new: true }
    );

    if (!bin) {
      return res.status(404).json({ message: "Dustbin nahi mila." });
    }

    if (currentLevel >= 90) {
      console.log(`⚠️ ALERT: Dustbin ${bin.name} (${bin.area}) is ${currentLevel}% FULL!`);
    }

    // 4. Response hardware ko bhejein
    res.status(200).json({
      success: true,
      message: "Level updated successfully",
      bin_name: bin.name,
      currentLevel: bin.currentLevel
    });

  } catch (error) {
    console.error("Hardware Update Error:", error.message);
    res.status(500).json({ message: "Server error during level update" });
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