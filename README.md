# StoryForge Backend

RAG-enhanced backend for the StoryForge iOS app, providing intelligent story generation with contextual knowledge.

## Features

- 🤖 **AI Story Generation**: Powered by Google Gemini 2.5 Flash
- 🔍 **RAG (Retrieval-Augmented Generation)**: Context-aware story responses
- 📚 **Story Knowledge Base**: Characters, locations, story beats, and lore
- 🔒 **Secure**: Environment-based API key management
- 🚀 **Production Ready**: Clean Express.js architecture

## Quick Start

1. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Set up environment**:
   ```bash
   cp .env.example .env
   # Edit .env and add your GOOGLE_GENAI_API_KEY
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

## API Endpoints

### RAG-Enhanced Story Generation
- `POST /api/simple-story/generate-rag` - Story generation with context retrieval
- `POST /api/simple-story/search-context` - Search story knowledge base

### Health Check
- `GET /health` - Service health status

## Example Usage

```bash
# RAG-enhanced story generation
curl -X POST http://localhost:3000/api/simple-story/whispering-woods/generate-rag \
  -H "Content-Type: application/json" \
  -d '{
    "userMessage": "I want to find Whiskers and ask about Thornwick",
    "conversationHistory": []
  }'

# Search story context
curl -X POST http://localhost:3000/api/simple-story/search-context \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Whiskers cat guide",
    "maxResults": 3
  }'
```

## Story Knowledge Base

The backend includes rich story content:

- **Characters**: Whiskers (guide), Thornwick (corrupted guardian), Elder Oak (oracle)
- **Locations**: Whispering Woods, Shadow Vale, Crystal Chamber, Forgotten Glade  
- **Story Beats**: Decision points, character meetings, major conflicts
- **Lore**: Crystal origins, seasonal magic, corruption mechanics

## iOS Integration

Replace direct Gemini API calls in your iOS `GeminiService.swift`:

```swift
// Instead of direct Gemini API
let response = await gemini25Flash.generate(prompt: prompt)

// Call your RAG backend
let response = await callRAGBackend(prompt: prompt)
```

## Development

- `npm run dev` - Start with hot reload
- `npm run build` - Build TypeScript  
- `npm run start` - Start production server

## Environment Variables

```env
GOOGLE_GENAI_API_KEY=your_gemini_api_key_here
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000
```

## Architecture

- **Express.js**: Clean REST API
- **Direct Gemini API**: No framework overhead
- **Local RAG**: Fast story context search
- **TypeScript**: Type-safe development