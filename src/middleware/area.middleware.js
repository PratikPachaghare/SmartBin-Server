import Dustbin from '../models/Dustbin.js'

export const restrictToArea = (req, res, next) => {
  try {
    if (req.user && req.user.role === 'worker') {
      req.areaFilter = { area: req.user.area }
    }
    next()
  } catch (err) {
    next(err)
  }
}

// Ensure the dustbin in `req.params.id` belongs to the same area for workers.
export const ensureSameArea = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized' })

    if (req.user.role === 'admin') return next()

    const id = req.params.id
    if (!id) return res.status(400).json({ success: false, message: 'Missing id' })

    const dustbin = await Dustbin.findById(id).select('area')
    if (!dustbin) return res.status(404).json({ success: false, message: 'Dustbin not found' })

    if (dustbin.area !== req.user.area) {
      return res.status(403).json({ success: false, message: 'Forbidden: access to this dustbin is restricted' })
    }

    next()
  } catch (err) {
    next(err)
  }
}
