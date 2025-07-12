import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../config/database';

export interface User {
  id: string;
  email: string;
  name: string;
  created_at: Date;
}

export interface AuthTokens {
  accessToken: string;
  user: User;
}

export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  private readonly JWT_EXPIRES_IN = '7d';

  async registerUser(email: string, name: string, password: string): Promise<AuthTokens> {
    const db = getDatabase();
    
    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const result = await db.query(
      `INSERT INTO users (email, name, password_hash) 
       VALUES ($1, $2, $3) 
       RETURNING id, email, name, created_at`,
      [email.toLowerCase(), name, passwordHash]
    );

    const user = result.rows[0];
    const accessToken = this.generateToken(user.id);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at
      }
    };
  }

  async loginUser(email: string, password: string): Promise<AuthTokens> {
    const db = getDatabase();
    
    // Find user
    const result = await db.query(
      'SELECT id, email, name, password_hash, created_at FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    const accessToken = this.generateToken(user.id);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at
      }
    };
  }

  async getUserFromToken(token: string): Promise<User | null> {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as { userId: string };
      const db = getDatabase();
      
      const result = await db.query(
        'SELECT id, email, name, created_at FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const user = result.rows[0];
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at
      };
    } catch (error) {
      return null;
    }
  }

  private generateToken(userId: string): string {
    return jwt.sign(
      { userId },
      this.JWT_SECRET,
      { expiresIn: this.JWT_EXPIRES_IN }
    );
  }

  async validatePassword(password: string): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/(?=.*\d)/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}