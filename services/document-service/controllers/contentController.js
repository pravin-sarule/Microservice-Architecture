// // controllers/chatController.js
// const pool = require('../config/db'); // your PostgreSQL connection


// /* ============================================================
//    CASE TYPES
// ============================================================ */

// // Fetch all case types
// const getCaseTypes = async (req, res) => {
//   try {
//     const result = await docDB.query(`SELECT * FROM case_types ORDER BY id ASC`);
//     res.status(200).json(result.rows);
//   } catch (error) {
//     console.error('Error fetching case types:', error.message);
//     res.status(500).json({ error: 'Failed to fetch case types: ' + error.message });
//   }
// };

// // Fetch sub-types for a specific case type
// const getSubTypesByCaseType = async (req, res) => {
//   const { caseTypeId } = req.params;

//   try {
//     const result = await docDB.query(
//       `SELECT * FROM sub_types WHERE case_type_id = $1 ORDER BY id ASC`,
//       [caseTypeId]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({ message: 'No sub-types found for this case type' });
//     }

//     res.status(200).json(result.rows);
//   } catch (error) {
//     console.error('Error fetching sub-types:', error.message);
//     res.status(500).json({ error: 'Failed to fetch sub-types: ' + error.message });
//   }
// };

// /* ============================================================
//    COURTS
// ============================================================ */

// // Fetch all courts
// const getCourts = async (req, res) => {
//   try {
//     const result = await docDB.query(`SELECT * FROM courts ORDER BY id ASC`);
//     res.status(200).json(result.rows);
//   } catch (error) {
//     console.error('Error fetching courts:', error.message);
//     res.status(500).json({ error: 'Failed to fetch courts: ' + error.message });
//   }
// };

// // Fetch courts by level (e.g., High Court, District Court)
// const getCourtsByLevel = async (req, res) => {
//   const { level } = req.params;

//   try {
//     const result = await docDB.query(
//       `SELECT * FROM courts WHERE LOWER(court_level) = LOWER($1) ORDER BY id ASC`,
//       [level]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({ message: 'No courts found for this level' });
//     }

//     res.status(200).json(result.rows);
//   } catch (error) {
//     console.error('Error fetching courts by level:', error.message);
//     res.status(500).json({ error: 'Failed to fetch courts: ' + error.message });
//   }
// };

// // Fetch single court by ID
// const getCourtById = async (req, res) => {
//   const { id } = req.params;

//   try {
//     const result = await docDB.query(`SELECT * FROM courts WHERE id = $1`, [id]);
//     if (result.rows.length === 0) {
//       return res.status(404).json({ message: 'Court not found' });
//     }
//     res.status(200).json(result.rows[0]);
//   } catch (error) {
//     console.error('Error fetching court by ID:', error.message);
//     res.status(500).json({ error: 'Failed to fetch court: ' + error.message });
//   }
// };


// const getJudgesByBench = async (req, res) => {
//   const { courtId, benchName } = req.query; // /judges?courtId=1&benchName=Principal Bench

//   try {
//     const result = await docDB.query(
//       `SELECT * FROM judges 
//        WHERE court_id = $1 
//        AND LOWER(bench_name) = LOWER($2)
//        ORDER BY name ASC`,
//       [courtId, benchName]
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({ message: 'No judges found for this bench' });
//     }

//     res.status(200).json(result.rows);
//   } catch (error) {
//     console.error('Error fetching judges:', error.message);
//     res.status(500).json({ error: 'Failed to fetch judges: ' + error.message });
//   }
// };


// module.exports = {
 
//   getCaseTypes,
//   getSubTypesByCaseType,
//   getCourts,
//   getCourtById,
//     getJudgesByBench,
//   getCourtsByLevel
// }



// controllers/chatController.js
const pool = require('../config/db'); // PostgreSQL connection

/* ============================================================
   CASE TYPES
============================================================ */

// Fetch all case types
const getCaseTypes = async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM case_types ORDER BY id ASC`);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching case types:', error.message);
    res.status(500).json({ error: 'Failed to fetch case types: ' + error.message });
  }
};

// Fetch sub-types for a specific case type
const getSubTypesByCaseType = async (req, res) => {
  const { caseTypeId } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM sub_types WHERE case_type_id = $1 ORDER BY id ASC`,
      [caseTypeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No sub-types found for this case type' });
    }

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching sub-types:', error.message);
    res.status(500).json({ error: 'Failed to fetch sub-types: ' + error.message });
  }
};

/* ============================================================
   COURTS
============================================================ */

// Fetch all courts
const getCourts = async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM courts ORDER BY id ASC`);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching courts:', error.message);
    res.status(500).json({ error: 'Failed to fetch courts: ' + error.message });
  }
};

// Fetch courts by level (e.g., High Court, District Court)
const getCourtsByLevel = async (req, res) => {
  const { level } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM courts WHERE LOWER(court_level) = LOWER($1) ORDER BY id ASC`,
      [level]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No courts found for this level' });
    }

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching courts by level:', error.message);
    res.status(500).json({ error: 'Failed to fetch courts: ' + error.message });
  }
};

// Fetch single court by ID
const getCourtById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(`SELECT * FROM courts WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Court not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching court by ID:', error.message);
    res.status(500).json({ error: 'Failed to fetch court: ' + error.message });
  }
};

/* ============================================================
   JUDGES
============================================================ */

// Fetch judges by bench (example: /judges?courtId=1&benchName=Principal Bench)
const getJudgesByBench = async (req, res) => {
  const { courtId, benchName } = req.query;

  try {
    const result = await pool.query(
      `SELECT * FROM judges 
       WHERE court_id = $1 
       AND LOWER(bench_name) = LOWER($2)
       ORDER BY name ASC`,
      [courtId, benchName]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No judges found for this bench' });
    }

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching judges:', error.message);
    res.status(500).json({ error: 'Failed to fetch judges: ' + error.message });
  }
};

/* ============================================================
   EXPORTS
============================================================ */

module.exports = {
  getCaseTypes,
  getSubTypesByCaseType,
  getCourts,
  getCourtById,
  getCourtsByLevel,
  getJudgesByBench,
};
