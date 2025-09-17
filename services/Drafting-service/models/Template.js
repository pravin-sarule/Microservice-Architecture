const pool = require('../config/db');

class Template {
  static async create({ user_id, name, html, is_public = false, access_level = 'free' }) {
    const query = `
      INSERT INTO templates (user_id, name, html, is_public, access_level)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const values = [user_id, name, html, is_public, access_level];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  static async findById(id) {
    const query = 'SELECT * FROM templates WHERE id = $1;';
    const { rows } = await pool.query(query, [id]);
    return rows[0];
  }

  static async findByUserId(user_id) {
    const query = 'SELECT t.*, sp.template_access FROM templates t LEFT JOIN user_subscriptions us ON t.user_id = us.user_id LEFT JOIN subscription_plans sp ON us.plan_id = sp.id WHERE t.user_id = $1 OR t.is_public = TRUE;';
    const { rows } = await pool.query(query, [user_id]);
    return rows;
  }

  static async update(id, { name, html, is_public, access_level }) {
    const query = `
      UPDATE templates
      SET name = $1, html = $2, is_public = $3, access_level = $4
      WHERE id = $5
      RETURNING *;
    `;
    const values = [name, html, is_public, access_level, id];
    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  static async delete(id) {
    const query = 'DELETE FROM templates WHERE id = $1 RETURNING *;';
    const { rows } = await pool.query(query, [id]);
    return rows[0];
  }
}

module.exports = Template;