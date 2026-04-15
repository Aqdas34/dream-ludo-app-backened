# XLudo VPS Backend Setup & Deployment Guide

This document provides the absolute, step-by-step instructions to set up and deploy the XLudo backend on your fresh Ubuntu VPS.

---

## 🚀 1. Installation Procedure (Run once on VPS)

### A. System & Dependencies
Update your system and install essential tools:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y build-essential curl git redis-server nginx
```

### B. Nginx Configuration
Configure Nginx to proxy requests to your Node.js application:
```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3005;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
**Note**: Since you are using a direct IP, you cannot use SSL/HTTPS yet.

### C. PostgreSQL 15 Setup
Install and configure your database:
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create the Database and User
# Replace 'your_password' with a strong one!
sudo -u postgres psql -c "CREATE DATABASE ludo_prod_db;"
sudo -u postgres psql -c "CREATE USER ludo_admin WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ludo_prod_db TO ludo_admin;"
```

### C. Node.js (via NVM) & PM2
Install the runtime and process manager:
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install --lts
npm install -g pm2
```

---

## 🛠️ 2. Environment Configuration

1. Create a `.env` file in this directory on your VPS.
2. Add your production credentials (JWT Secret, Database URL, etc.).
3. **Internal DB URL Format**: 
   `DATABASE_URL=postgresql://ludo_admin:B9qp63RLyLf70iEQw3@localhost:5432/ludo_prod_db`

---

## 🔄 3. CI/CD Deployment (GitHub Actions)

Your **`deploy.yml`** in this folder is a reference for the automation script located at the repository root (`.github/workflows/deploy.yml`).

### To trigger a deployment:
Simply **Push to main** after setting up your **GitHub Secrets**:
- `VPS_IP`: Your server's public IP.
- `VPS_USER`: Your SSH username (usually `root` or `ubuntu`).
- `SSH_PRIVATE_KEY`: Your private SSH key.
- `DATABASE_URL`: Your production database link.

---

## Support & Verification
- **Internal Check**: `pm2 logs ludo-api`
- **External Check**: Visit `http://your-domain.com/api/health`

**Your's backend's is officially "Fortified" and's ready for its's professional's VPS's debut!** 🏆🛡️🕹️🚀✨
