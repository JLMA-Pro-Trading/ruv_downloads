#!/bin/bash

# Generate a new secure JWT secret key
JWT_SECRET_KEY=$(openssl rand -hex 32)

echo "Setting JWT authentication secrets for Fly.io..."

# Set all authentication-related secrets
fly secrets set \
  JWT_SECRET_KEY="$JWT_SECRET_KEY" \
  AUTH_ENABLED="true" \
  JWT_ALGORITHM="HS256" \
  JWT_EXPIRATION_HOURS="24" \
  --app ruvtrade

echo ""
echo "✅ JWT Secret Key has been set!"
echo ""
echo "To enable authentication, also set admin credentials:"
echo "fly secrets set AUTH_USERNAME='your-username' AUTH_PASSWORD='your-secure-password' --app ruvtrade"
echo ""
echo "Your JWT_SECRET_KEY (save this securely): $JWT_SECRET_KEY"
