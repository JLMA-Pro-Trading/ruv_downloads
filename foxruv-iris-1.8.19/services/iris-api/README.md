# IRIS Backend API Service

Backend service for IRIS managed mode authentication, credential proxy, and multi-tenant data access.

## Features

- 🔐 **Authentication** - Login, register, API key management
- 🔄 **Credential Proxy** - Proxy Supabase/LLM requests with RLS
- 🛡️ **Rate Limiting** - Tier-based rate limiting (100 req/min)
- 🔒 **Security** - Helmet, CORS, JWT, bcrypt
- 📊 **Usage Tracking** - Token usage, billing metrics
- 🚀 **Multi-tenant** - Row-Level Security (RLS) enforcement

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env

# Run development server
npm run dev

# Visit
open http://localhost:3000/health
```

## Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=development

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# JWT Secret
JWT_SECRET=your-secret-key-change-in-production

# CORS
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# LLM APIs (optional)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Rate Limiting
RATE_LIMIT_POINTS=100
RATE_LIMIT_DURATION=60
```

## API Endpoints

### Authentication

#### POST /auth/register

Create new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "apiKey": "iris_abc123...",
  "userId": "uuid",
  "email": "user@example.com",
  "tier": "free"
}
```

#### POST /auth/login

Login with email/password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "apiKey": "iris_abc123...",
  "userId": "uuid",
  "email": "user@example.com",
  "tier": "free"
}
```

#### POST /auth/validate

Validate API key.

**Headers:**
```
Authorization: Bearer iris_abc123...
```

**Response:**
```json
{
  "success": true,
  "userId": "uuid",
  "email": "user@example.com",
  "tier": "free"
}
```

#### POST /auth/refresh

Refresh API key (generate new one).

**Headers:**
```
Authorization: Bearer iris_abc123...
```

**Response:**
```json
{
  "success": true,
  "apiKey": "iris_xyz789...",
  "userId": "uuid"
}
```

#### GET /auth/me

Get current user info.

**Headers:**
```
Authorization: Bearer iris_abc123...
```

**Response:**
```json
{
  "success": true,
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "tier": "free",
  "created_at": "2025-01-01T00:00:00Z",
  "last_login": "2025-01-01T12:00:00Z"
}
```

### Proxy

#### POST /api/query

Query Supabase with RLS enforcement.

**Headers:**
```
Authorization: Bearer iris_abc123...
```

**Request:**
```json
{
  "table": "telemetry_events",
  "select": "*",
  "filters": {
    "project": "my-app"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "project": "my-app",
      "metric": "accuracy",
      "value": 0.95
    }
  ]
}
```

#### POST /api/llm/complete

Proxy LLM completion request (optional).

**Headers:**
```
Authorization: Bearer iris_abc123...
```

**Request:**
```json
{
  "prompt": "Analyze this code...",
  "model": "claude-3-5-sonnet-20241022"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "content": "Analysis: ..."
  }
}
```

## Database Schema

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  name TEXT,
  tier TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ
);

-- RLS policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own data"
  ON users
  FOR ALL
  USING (id = auth.uid());

-- LLM usage tracking
CREATE TABLE llm_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  model TEXT NOT NULL,
  prompt_tokens INT,
  completion_tokens INT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own usage"
  ON llm_usage
  FOR SELECT
  USING (user_id = auth.uid());
```

## Deployment

### Vercel

```bash
vercel deploy
```

### Railway

```bash
railway up
```

### Docker

```bash
# Build
docker build -t iris-api .

# Run
docker run -p 3000:3000 --env-file .env iris-api
```

### Heroku

```bash
heroku create iris-api
heroku config:set SUPABASE_URL=...
heroku config:set SUPABASE_SERVICE_KEY=...
git push heroku main
```

## Development

```bash
# Install dependencies
npm install

# Run dev server (hot reload)
npm run dev

# Build for production
npm run build

# Run production
npm start

# Run tests
npm test
```

## Security

- ✅ Helmet.js for HTTP headers
- ✅ CORS with origin whitelist
- ✅ Rate limiting (100 req/min default)
- ✅ bcrypt password hashing (10 rounds)
- ✅ Row-Level Security (RLS) enforcement
- ✅ API key validation
- ✅ JWT for token management

## Rate Limiting

Tier-based limits:

- **Free**: 100 requests/minute
- **Pro**: 1000 requests/minute
- **Enterprise**: Unlimited

Configure in `.env`:
```bash
RATE_LIMIT_POINTS=100
RATE_LIMIT_DURATION=60
```

## Monitoring

### Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-01T12:00:00.000Z",
  "version": "1.0.0"
}
```

### Logs

Development:
```bash
npm run dev
# Console logs enabled
```

Production:
```bash
LOG_LEVEL=info npm start
```

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test
npm test -- auth.test.ts
```

## Contributing

1. Fork the repo
2. Create feature branch
3. Add tests
4. Submit PR

## License

MIT
