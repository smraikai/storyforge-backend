import { Router } from 'express';
import { AuthService } from '../services/authService';
import { AuthMiddleware } from '../middleware/auth';

const router = Router();
const authService = new AuthService();
const authMiddleware = new AuthMiddleware();

// Register new user
router.post('/register', async (req, res) => {
  try {
    const { email, name, password } = req.body;

    // Validate input
    if (!email || !name || !password) {
      return res.status(400).json({
        error: 'Email, name, and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format'
      });
    }

    // Validate password
    const passwordValidation = await authService.validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: 'Password validation failed',
        details: passwordValidation.errors
      });
    }

    const result = await authService.registerUser(email, name, password);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: result
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if ((error as Error).message === 'User with this email already exists') {
      return res.status(409).json({
        error: 'User with this email already exists'
      });
    }

    res.status(500).json({
      error: 'Registration failed',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Apple Sign In
router.post('/apple', async (req, res) => {
  try {
    const { appleUserId, email, name } = req.body;

    if (!appleUserId || !email || !name) {
      return res.status(400).json({
        error: 'Apple user ID, email, and name are required'
      });
    }

    const result = await authService.signInWithApple(appleUserId, email, name);

    res.json({
      success: true,
      message: 'Apple Sign In successful',
      data: result
    });

  } catch (error) {
    console.error('Apple Sign In error:', error);
    res.status(500).json({
      error: 'Apple Sign In failed',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      });
    }

    const result = await authService.loginUser(email, password);

    res.json({
      success: true,
      message: 'Login successful',
      data: result
    });

  } catch (error) {
    console.error('Login error:', error);
    
    if ((error as Error).message === 'Invalid email or password') {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    res.status(500).json({
      error: 'Login failed',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Get current user profile
router.get('/me', authMiddleware.authenticate.bind(authMiddleware), (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
});

// Refresh token (extend session)
router.post('/refresh', authMiddleware.authenticate.bind(authMiddleware), async (req, res) => {
  try {
    // Generate new token for current user
    const authService = new AuthService();
    const newToken = (authService as any).generateToken(req.user!.id);

    res.json({
      success: true,
      accessToken: newToken,
      user: req.user
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      error: 'Token refresh failed'
    });
  }
});

module.exports = router;