import { Request, Response, NextFunction } from 'express';
import { AuthService, User } from '../services/authService';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export class AuthMiddleware {
  private authService = new AuthService();

  async authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      const token = authHeader.substring(7); // Remove "Bearer " prefix
      const user = await this.authService.getUserFromToken(token);

      if (!user) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('Authentication error:', error);
      res.status(401).json({ error: 'Authentication failed' });
    }
  }

  // Optional authentication - doesn't fail if no token
  async optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const user = await this.authService.getUserFromToken(token);
        req.user = user || undefined;
      }

      next();
    } catch (error) {
      // Continue without authentication
      next();
    }
  }
}

// Create middleware instance
const authMiddleware = new AuthMiddleware();

// Export the middleware functions
export const authenticateToken = authMiddleware.authenticate.bind(authMiddleware);
export const optionalAuth = authMiddleware.optionalAuth.bind(authMiddleware);