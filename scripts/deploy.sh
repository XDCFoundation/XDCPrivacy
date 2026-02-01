#!/bin/bash

# XDC Canton Privacy - Deployment Script
# Target: 95.217.56.168

set -e

SERVER="root@95.217.56.168"
DEPLOY_DIR="/opt/xdc-canton-privacy"

echo "🚀 Deploying XDC Canton Privacy System..."

# Create deployment directory
ssh $SERVER "mkdir -p $DEPLOY_DIR"

# Sync files (excluding node_modules)
echo "📦 Syncing files..."
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'dist' \
  --exclude '.git' \
  --exclude '*.log' \
  ./ $SERVER:$DEPLOY_DIR/

# Deploy on server
ssh $SERVER << 'ENDSSH'
cd /opt/xdc-canton-privacy

echo "🔧 Setting up environment..."
cp backend/.env.example backend/.env
# Update .env with production values
cat > backend/.env << 'EOF'
DATABASE_URL="postgresql://canton:canton_secret_2025@localhost:5432/canton_privacy?schema=public"
PORT=4000
NODE_ENV=production
JWT_SECRET=xdc-canton-privacy-jwt-secret-2025-production
JWT_EXPIRES_IN=7d
XDC_RPC_URL=https://rpc.apothem.network
XDC_CHAIN_ID=51
CORS_ORIGIN=https://canton.xdc.network
EOF

echo "🐳 Building and starting containers..."
docker compose down || true
docker compose build --no-cache
docker compose up -d

echo "⏳ Waiting for services to start..."
sleep 10

# Run database migrations
echo "🗄️ Running database migrations..."
docker compose exec -T backend npx prisma migrate deploy

echo "✅ Deployment complete!"
docker compose ps
ENDSSH

echo "🎉 XDC Canton Privacy deployed successfully!"
echo "   Frontend: https://canton.xdc.network"
echo "   API: https://api.canton.xdc.network"
