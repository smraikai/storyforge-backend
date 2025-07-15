const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const connectionString = process.env.DB_HOST;
const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkUsers() {
  try {
    console.log('🔍 Checking users table...');
    
    // Check if users table exists and what's in it
    const result = await pool.query('SELECT id, email, name, auth_provider, created_at FROM users LIMIT 10');
    
    console.log(`📊 Found ${result.rows.length} users:`);
    result.rows.forEach(user => {
      console.log(`  - ${user.email} (${user.name}) - ${user.auth_provider}`);
    });
    
    // Check table structure
    const structure = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 Users table structure:');
    structure.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkUsers();