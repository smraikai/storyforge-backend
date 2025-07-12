import { Router } from 'express';
import { getDatabase } from '../config/database';
import fs from 'fs';
import path from 'path';

const router = Router();

// Initialize database schema (one-time setup)
router.post('/init-db', async (req, res) => {
  try {
    // Security check - only allow in development or with special header
    const initKey = req.headers['x-init-key'];
    if (process.env.NODE_ENV === 'production' && initKey !== process.env.DB_INIT_KEY) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const db = getDatabase();
    
    // Read schema file
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    // Execute schema
    await db.query(schema);
    
    res.json({
      success: true,
      message: 'Database schema initialized successfully'
    });

  } catch (error) {
    console.error('Database initialization error:', error);
    res.status(500).json({
      error: 'Failed to initialize database',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Check database connection
router.get('/health-db', async (req, res) => {
  try {
    const db = getDatabase();
    const result = await db.query('SELECT NOW() as timestamp');
    
    res.json({
      success: true,
      message: 'Database connection healthy',
      timestamp: result.rows[0].timestamp
    });

  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(500).json({
      error: 'Database connection failed',
      details: (error as Error).message
    });
  }
});

module.exports = router;