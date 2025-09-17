const pool = require("../config/db");

/**
 * @description Creates a new support query with optional file attachment.
 * @route POST /api/support
 */
exports.createQuery = async (req, res) => {
  try {
    const userId = req.user.id;
    const { subject, priority, message } = req.body;

    let fileName = null;
    if (req.file) {
      fileName = req.file.originalname;
    }

    if (!subject || !priority || !message) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const result = await pool.query(
      "INSERT INTO support_queries (user_id, subject, priority, message, attachment_url, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [userId, subject, priority, message, fileName, "open"]
    );

    res.status(201).json({
      message: "Support query created successfully",
      query: result.rows[0],
    });
  } catch (error) {
    console.error("Error creating support query:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
