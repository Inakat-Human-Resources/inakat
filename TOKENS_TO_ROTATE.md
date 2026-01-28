# 🔐 TOKENS TO ROTATE - SECURITY INCIDENT

**Date:** January 27, 2026
**Severity:** CRITICAL
**Reason:** Credentials were exposed in `.env.example` which is tracked in git history

## ⚠️ IMPORTANT
All tokens listed below have been compromised and MUST be rotated immediately before going to production.

---

## 🔴 CRITICAL PRIORITY (Rotate Immediately)

### 1. Supabase Database Credentials
**Exposed value:** Password visible in connection string
**Where to rotate:** [Supabase Dashboard](https://supabase.com/dashboard/project/hgcewfrdmytspvbtxkdy/settings/database)
**Steps:**
1. Go to Project Settings → Database
2. Click "Reset database password"
3. Update `DATABASE_URL` and `DIRECT_URL` in production environment
4. Run `npx prisma migrate deploy` to verify connection

**Variables affected:**
- `DATABASE_URL`
- `DIRECT_URL`

---

### 2. JWT Secret
**Exposed value:** `a0f950f27f7deac87b6dd116c9ea92d9572fe529d964063e7e76bc9c7ab7f467`
**Where to rotate:** Generate new secret locally
**Steps:**
1. Generate new secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
2. Update `JWT_SECRET` in production environment
3. **WARNING:** All existing user sessions will be invalidated!

**Variables affected:**
- `JWT_SECRET`

---

### 3. Admin Password
**Exposed value:** `AdminInakat2024!`
**Where to rotate:** Application database + environment
**Steps:**
1. Update `ADMIN_PASSWORD` in environment variables
2. Run seed script OR manually update in database:
   ```sql
   -- After generating new bcrypt hash
   UPDATE "User" SET password = 'NEW_BCRYPT_HASH' WHERE email = 'admin@inakat.com';
   ```
3. Consider changing admin email too for extra security

**Variables affected:**
- `ADMIN_PASSWORD`
- `ADMIN_EMAIL` (recommended)

---

## 🟠 HIGH PRIORITY (Rotate This Week)

### 4. Vercel Blob Storage Token
**Exposed value:** `vercel_blob_rw_LQEBHSz0gem31tpE_MVmWVRcD2gTrNjGMbVN3qCsmMC2yOO`
**Where to rotate:** [Vercel Dashboard](https://vercel.com/dashboard/stores)
**Steps:**
1. Go to Storage → Your Blob Store
2. Click "Regenerate Token"
3. Update `BLOB_READ_WRITE_TOKEN` in Vercel project settings
4. Existing files remain accessible; only new uploads need new token

**Variables affected:**
- `BLOB_READ_WRITE_TOKEN`

---

### 5. MercadoPago Credentials
**Exposed value:**
- Access Token: `TEST-8496866396220386-112213-cd7f64a82f09a2a798065fcb7e81986a-65593296`
- Public Key: `TEST-0c1e46d3-f409-4cf1-8dbc-bb1dc873d6d7`

**Where to rotate:** [MercadoPago Developers](https://www.mercadopago.com.mx/developers/panel/app)
**Steps:**
1. Go to Your Applications → Select your app
2. Go to Credentials → Test/Production
3. Click "Renew credentials"
4. Update both tokens in production environment

**Note:** These are TEST credentials, but still should be rotated. For production, you'll need PRODUCTION credentials.

**Variables affected:**
- `MERCADOPAGO_ACCESS_TOKEN`
- `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY`

---

### 6. Google Maps API Key
**Exposed value:** `AIzaSyArGYtP3IS3F8j3VRRP1C9vuS6nhY2eXw8`
**Where to rotate:** [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
**Steps:**
1. Go to APIs & Services → Credentials
2. Either:
   - **Option A:** Add HTTP referrer restrictions to existing key (recommended for now)
   - **Option B:** Create new key and delete old one
3. Restrict to your domains: `yourdomain.com/*`, `localhost:3000/*`

**Variables affected:**
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

---

## 📋 Post-Rotation Checklist

- [ ] Supabase database password rotated
- [ ] JWT_SECRET regenerated (users will need to re-login)
- [ ] Admin password changed
- [ ] Vercel Blob token regenerated
- [ ] MercadoPago credentials regenerated
- [ ] Google Maps key restricted or regenerated
- [ ] All tokens updated in Vercel project environment variables
- [ ] Application tested with new credentials
- [ ] Old `.env.example` removed from git history (see below)

---

## 🧹 Cleaning Git History

**DO NOT RUN THESE COMMANDS** until you have:
1. Backed up the repository
2. Rotated all credentials above
3. Coordinated with all team members

### Option A: Using git-filter-repo (Recommended)

```bash
# Install git-filter-repo
pip install git-filter-repo

# Backup first!
git clone --mirror git@github.com:your-org/inakat.git inakat-backup.git

# Remove .env.example from all history
git filter-repo --invert-paths --path .env.example

# Force push to remote (requires --force)
git push origin --force --all
git push origin --force --tags
```

### Option B: Using BFG Repo-Cleaner

```bash
# Download BFG from https://rtyley.github.io/bfg-repo-cleaner/

# Clone a fresh copy
git clone --mirror git@github.com:your-org/inakat.git

# Run BFG
java -jar bfg.jar --delete-files .env.example inakat.git

# Clean up
cd inakat.git
git reflog expire --expire=now --all && git gc --prune=now --aggressive

# Force push
git push --force
```

### After Cleaning History

All team members must:
```bash
# Delete local repo and re-clone
rm -rf inakat
git clone git@github.com:your-org/inakat.git

# OR force update existing repo (destructive!)
git fetch origin
git reset --hard origin/main
git clean -fd
```

---

## 📞 Support Contacts

- **Supabase:** support@supabase.io
- **Vercel:** https://vercel.com/support
- **MercadoPago:** https://www.mercadopago.com.mx/developers/support
- **Google Cloud:** https://cloud.google.com/support

---

**Document maintained by:** Security Team
**Last updated:** January 27, 2026
