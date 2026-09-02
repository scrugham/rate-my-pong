# Rate My Pong

Office ping pong ELO league. Log singles and doubles, climb the board.

## Local preview

```bash
npm install
npm run dev
```

Open http://localhost:3000

Local data uses `data/db.json` (demo-seeded on first run).

## Publish to Vercel + ratemypong.com

Production needs a real database. Local JSON will not work on Vercel.

### 1) Create a Neon database (free)

1. Go to https://console.neon.tech and sign in
2. Create a project (e.g. `rate-my-pong`)
3. Copy the connection string (`DATABASE_URL`, use the pooled / serverless URL if Neon shows one)

Optional: paste and run [`data/schema.sql`](data/schema.sql) in the Neon SQL editor. The app also creates tables automatically on first request.

### 2) Deploy from Git Bash

```bash
cd "/c/Users/DanielScrugham/Downloads/Rate My Pong"

npm install
npx vercel login
npx vercel
```

When prompted, link/create the Vercel project. Then set the database URL and ship production:

```bash
npx vercel env add DATABASE_URL production
# paste your Neon connection string when asked

npx vercel --prod
```

### 3) Attach ratemypong.com

In the Vercel dashboard for this project:

1. Settings → Domains → Add `ratemypong.com` and `www.ratemypong.com`
2. At your domain registrar, set the DNS Vercel shows (usually):
   - `A` record for `@` → `76.76.21.21`
   - `CNAME` for `www` → `cname.vercel-dns.com`
3. Wait for DNS/SSL to go green (can take a few minutes to an hour)

Or from Git Bash after the project exists:

```bash
npx vercel domains add ratemypong.com
```

### 4) First use on production

Production starts with an **empty roster** (no demo players).  
Have people use **Add Player**, then log matches.

## Notes

- Search engines are blocked (`robots.txt`, meta robots, `X-Robots-Tag`)
- Set `DATABASE_URL` locally in `.env.local` if you want to test against Neon before deploy
