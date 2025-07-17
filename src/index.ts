import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

async function startServer() {
  // Load environment variables first
  dotenv.config();

  // Initialize Firebase Admin after dotenv loads (using dynamic import)
  await import('./config/firebase');

  const newsRoutes = (await import('./routes/news')).default;
  const inventoryRoutes = (await import('./routes/inventory')).default;
  const worldStateRoutes = (await import('./routes/worldState')).default;

  // Express server setup
  const app = express();
  const PORT = process.env.PORT || 3000;

  // Middleware
  app.use(helmet());
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));

  // Health check endpoint
  app.get('/health', (_, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'storyforge-backend'
    });
  });

  // API routes
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/sessions', require('./routes/sessions'));
  app.use('/api/stories', require('./routes/stories'));
  app.use('/api/story', require('./routes/simpleStory'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/news', newsRoutes);
  app.use('/api/inventory', inventoryRoutes);
  app.use('/api/world', worldStateRoutes);

  // Error handling middleware
  app.use((err: Error, _: express.Request, res: express.Response, __: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
  });

  // Start server
  app.listen(PORT, () => {
    console.log(`🚀 StoryForge backend running on port ${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/health`);
    console.log(`📚 Stories API: http://localhost:${PORT}/api/stories`);
    console.log(`🎭 RAG Story API: http://localhost:${PORT}/api/story/{storyId}/generate-rag`);
  });

  return app;
}

// Start the server
startServer().catch(console.error);