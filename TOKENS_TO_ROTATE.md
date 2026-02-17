# 🔐 TOKENS ROTATION STATUS

**Last updated:** February 16, 2026

## Status

All compromised credentials from the January 2026 incident have been documented
and the rotation process has been initiated.

**⚠️ The original version of this file contained actual secret values and has been sanitized.**

## Rotation Checklist

- [ ] Supabase database password — Rotate in Supabase Dashboard → Project Settings → Database
- [ ] JWT_SECRET — Generate new: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- [ ] Admin password — Update in env vars + database
- [ ] Vercel Blob token — Regenerate in Vercel Dashboard → Storage
- [ ] MercadoPago credentials — Regenerate in MercadoPago Developers Panel
- [ ] Google Maps API key — Restrict or regenerate in Google Cloud Console

## Post-Rotation

- [ ] All tokens updated in Vercel project environment variables
- [ ] Application tested with new credentials
- [ ] Git history cleaned (see below)

## Cleaning Git History

After ALL tokens have been rotated, clean the old file from git history:
```bash
# Backup first!
git clone --mirror <repo-url> backup.git

# Remove old file from all history
pip install git-filter-repo
git filter-repo --invert-paths --path TOKENS_TO_ROTATE.md
git filter-repo --invert-paths --path .env.example

# Force push
git push origin --force --all
```

All team members must re-clone after history rewrite.

---

_Actual secret values are stored securely outside the repository._
