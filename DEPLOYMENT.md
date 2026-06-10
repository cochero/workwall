# Deploying Workwall to wall.klickevents.in

Target: Ubuntu VPS with Nginx + MySQL + Node 20+ + PM2 (same pattern as celselabs-cms).

## 1. DNS
Point `wall.klickevents.in` (A record) at the VPS IP.

## 2. Code

```bash
sudo mkdir -p /var/www/workwall && sudo chown $USER /var/www/workwall
git clone <repo-url> /var/www/workwall
cd /var/www/workwall
```

## 3. Database

```sql
CREATE DATABASE workwall CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'workwall'@'localhost' IDENTIFIED BY '<strong-password>';
GRANT ALL PRIVILEGES ON workwall.* TO 'workwall'@'localhost';
FLUSH PRIVILEGES;
```

## 4. Backend

```bash
cd /var/www/workwall/backend
cp .env.example .env
nano .env       # fill in everything below
npm ci --omit=dev
npm run migrate
SEED_ADMIN_PASSWORD='<strong-admin-password>' npm run seed   # admin only, no --demo in prod
```

`.env` checklist:
- `NODE_ENV=production`
- `DB_USER=workwall`, `DB_PASSWORD=<strong-password>`, `DB_NAME=workwall`
- `JWT_SECRET` — generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `STORAGE_DRIVER=s3`
- `S3_ENDPOINT=https://eu2.contabostorage.com` (match your Contabo region)
- `S3_REGION=eu2`, `S3_BUCKET=workwall` (create the bucket in the Contabo panel first)
- `S3_ACCESS_KEY` / `S3_SECRET_KEY` from Contabo Object Storage credentials

## 5. Frontend

```bash
cd /var/www/workwall/frontend
npm ci
npm run build        # outputs frontend/dist, served by nginx
```

## 6. Nginx + HTTPS

```bash
sudo cp /var/www/workwall/deploy/nginx-wall.klickevents.in.conf /etc/nginx/sites-available/wall.klickevents.in
sudo ln -s /etc/nginx/sites-available/wall.klickevents.in /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d wall.klickevents.in
```

## 7. PM2

```bash
cd /var/www/workwall
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup   # follow the printed instruction once
```

## 8. Updates / redeploy

```bash
cd /var/www/workwall
git pull
cd backend && npm ci --omit=dev && npm run migrate
cd ../frontend && npm ci && npm run build
pm2 restart workwall-api
```

## Security checklist before inviting clients
- [ ] Strong `JWT_SECRET`, strong DB password, strong admin password
- [ ] `.env` is NOT in git (gitignored) and is readable only by the deploy user
- [ ] HTTPS active (certbot) — the auth cookie is `secure` in production
- [ ] Contabo bucket is private (no public read); the app uses presigned URLs
- [ ] Create real team/client users via Admin → Users; never reuse the demo passwords
