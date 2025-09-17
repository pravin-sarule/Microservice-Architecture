
// // routes/supportRoutes.js
// const express = require("express");
// const router = express.Router();
// const supportController = require("../controllers/supportController");
// const { protect } = require("../middleware/auth");

// router.post("/", protect, supportController.createQuery);
// router.get("/", protect, supportController.getMyQueries);

// module.exports = router;
const express = require("express");
const router = express.Router();
const multer = require("multer");
const { protect } = require("../middleware/auth");
const supportController = require("../controllers/supportController");

// Configure multer (store in memory or disk)
const upload = multer({ storage: multer.memoryStorage() });

// Route for creating support query
router.post(
  "/",
  protect,
  upload.single("attachment"), // this handles the file field
  supportController.createQuery
);

module.exports = router;
