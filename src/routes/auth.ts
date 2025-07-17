import { Router } from 'express';
import admin from '../config/firebase';

const router = Router();

// Middleware to verify Firebase tokens
const verifyFirebaseToken = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No valid authorization header' });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture
    };
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Get current user profile (Firebase user)
router.get('/me', verifyFirebaseToken, (req: any, res: any) => {
  res.json({
    success: true,
    user: req.user
  });
});

// Health check endpoint for Firebase Auth
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Firebase Auth backend is healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;