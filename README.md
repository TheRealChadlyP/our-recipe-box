# Our Recipe Box ♡

A warm, farmhouse-inspired, mobile-first personal cookbook for your household. Cranberry-and-cream styling, bespoke kitchen illustrations, gingham accents, script lettering, and no recipe-blog filler.

## What's inside

- **First recipe included:** Stovetop Velveeta Mac & Cheese, with amounts and steps verified against the original Key to My Lime recipe.
- **Easy browsing:** Search by name or ingredient, filter by meal type, mark favorites.
- **Cook mode:** Tap ingredients and numbered steps to check them off as you cook.
- **Add recipes three ways:** Enter one manually; import a public recipe page URL (with the optional Cloudflare backend); or take/upload a photo and extract text directly on the phone using browser OCR. Handwriting and unusual layouts often need correction.
- **Edit everything:** Imported recipes open in an editor before saving, so you can remove the filler or fix missing details.
- **Private household sync:** Set up a simple shared code, and both phones use the same recipe collection.
- **Offline reading and editing:** The app saves a local copy and queues changes until the next sync.
- **Backups:** Export recipes to JSON and import that backup to another phone.
- **Installable:** Android Chrome and iPhone Safari can add the site to the home screen.

## Architecture

| Part | Technology | Required? |
| --- | --- | --- |
| Mobile web app | Plain HTML, CSS and JavaScript (no build process) | Yes |
| Hosting | GitHub Pages | For phones on the internet |
| Local storage / offline | localStorage + service worker | Built in |
| Family shared library | Cloudflare Worker + D1 database | Optional, for automatic syncing |
| Import a recipe by URL | Cloudflare Worker extracts Schema.org Recipe JSON-LD | Optional; uses same backend |
| Import a recipe from a photo | Tesseract.js OCR running locally in the browser | Built in; first use downloads OCR assets |

**Important limitation:** A static GitHub Pages site cannot reliably download arbitrary recipe websites from the browser because of CORS restrictions. For reliable URL importing, and for two phones to share the same library, you must deploy the included Cloudflare Worker and D1 database. Some websites block robots or don't publish structured recipes, so not every URL will import automatically; manual entry always works.

**Privacy note:** The GitHub Pages site is publicly reachable, but it contains *no personal recipes* beyond the included starter recipe. New recipes are saved on-device or, if you configure the backend, in your Cloudflare D1 database. The shared API requires a family access code. Both phones store the code in their own browser storage; choose a long, unique code and do not share it publicly. This is simple family-use authentication, not enterprise account security. GitHub's repository should never contain the code.

## Step 1 — Put it on GitHub Pages

1. Log in to GitHub as `TheRealChadlyP` and create a **new public repository** named `our-recipe-box`. Leave **Initialize with README** unchecked, because this project includes one.
2. Extract the ZIP on your computer, open a terminal inside the `our-recipe-box` folder, and run:

   ```bash
   git init -b main
   git add .
   git commit -m "Build Our Recipe Box"
   git remote add origin https://github.com/TheRealChadlyP/our-recipe-box.git
   git push -u origin main
   ```

3. On GitHub, open your new repository → **Settings** → **Pages** → under **Build and deployment**, choose **GitHub Actions**.
4. The included workflow (`.github/workflows/pages.yml`) deploys the site. Check the repository's **Actions** tab if the site doesn't appear immediately.
5. Open **https://therealchadlyp.github.io/our-recipe-box/** on a phone (GitHub usernames and domains are case-insensitive). This URL is the intended Pages address; it won't work until the site has been published successfully.

The entire cookbook works **locally, without any Cloudflare setup**. At this stage, however, each phone has its own recipes. Export/import can be used for manual transfer.

## Step 2 — Enable a shared library and importing from links

This takes a one-time Cloudflare account setup. Cloudflare Workers and D1 offer free tiers for small personal projects, subject to Cloudflare's current pricing and limits.

1. Create/sign in to your Cloudflare account at https://dash.cloudflare.com.
2. Install Node.js if it isn't already installed (for `npx`). In your project folder, open a terminal in **`worker/`**.
3. Sign in to Cloudflare:

   ```bash
   npx wrangler login
   ```

4. Create the database:

   ```bash
   npx wrangler d1 create our-recipe-box
   ```

5. Copy the returned **database_id** into `worker/wrangler.toml`, replacing `REPLACE_WITH_YOUR_D1_DATABASE_ID`.
6. Create the recipe table in your remote D1 database:

   ```bash
   npx wrangler d1 execute our-recipe-box --remote --file=./schema.sql
   ```

7. Set your **private** household password in Cloudflare (make it at least 12 characters):

   ```bash
   npx wrangler secret put HOUSEHOLD_CODE
   ```

   Enter your chosen code when prompted. **Never put the code in `wrangler.toml` or commit it to GitHub.**

8. Publish the API:

   ```bash
   npx wrangler deploy
   ```

9. Save the URL Wrangler prints, typically `https://our-recipe-box-api.<your-subdomain>.workers.dev`. The `https://.../api/health` address should show `{"ok":true}` (no password needed).
10. On your phone, open **Recipe Box → Settings → Shared family recipe box**. Enter the Worker URL and household access code. Tap **Connect & sync**.
11. On your wife's phone, open the same GitHub Pages site, add it to her home screen, and enter the **same** Worker URL and access code. Both phones now share the library automatically.

**Recommended hardening:** After publishing the GitHub Pages site, change `ALLOWED_ORIGIN = "*"` in `worker/wrangler.toml` to `ALLOWED_ORIGIN = "https://therealchadlyp.github.io"` and deploy again. CORS isn't a substitute for a strong household code, but this narrows which sites can call your API from a browser.

**How syncing works:** The first successful connection merges recipes already saved on that phone with the cloud. After that, the cloud is authoritative. Edits are queued offline and uploaded on reconnection. If both phones change the same recipe simultaneously, the most recently uploaded change wins. The app checks for updates when reopened and while open about every 45 seconds.

## Step 3 — Install it on each phone

- **Android, Chrome:** Open the Pages URL → Chrome menu (⋮) → **Install app** or **Add to Home screen**.
- **iPhone, Safari:** Open the Pages URL → Share → **Add to Home Screen**.

Adding to your home screen gives a full-screen, app-like experience. The first site visit must be online to cache assets; subsequent visits can load offline.

## Importing a recipe from a website

1. Open **Add** → **From a link**.
2. Paste a link to a recipe page.
3. The backend attempts to extract structured recipe metadata (Schema.org / JSON-LD): title, ingredients, steps, times, servings and a picture.
4. **Review** the filled-in editor and hit **Save recipe**.

Some recipe sites block automated access or have incomplete metadata. The app then suggests using **Write it myself**. The source URL stays attached to imported recipes.

## Saving a recipe from a photo

1. Tap **Add** → **From a photo**.
2. Choose **Take a photo** (uses the phone camera when supported) or **Choose a picture** from the device.
3. The browser downloads the Tesseract.js OCR engine on first use, then processes the selected image **locally on the device**; the image isn't posted to the Cloudflare API or stored as a recipe photo.
4. When recognition completes, the app attempts to identify a recipe name, ingredients, instructions, and tips. An **editable draft** opens so you can correct OCR mistakes before saving.

**Limits:** Printed cards and packaging generally work better than handwriting or cursive. OCR may miss fractional measurements, split instructions, and misplace headings. Always review the ingredient quantities and cooking directions carefully. The app does **not** automatically interpret recipes as reliably as a dedicated multimodal AI service; it uses heuristic parsing after recognizing text. The OCR library and its language data require internet access on first use. The photo feature doesn't depend on the family Cloudflare backend.

## Backups and troubleshooting

- The app stores local data in **browser storage on each device**. If you clear browser/site data, recipes that have *not* synced or been exported may be lost.
- In Settings, use **Export recipes** regularly if you haven't enabled sharing. Import backup **merges** recipes by ID and keeps the more recently updated version.
- If connecting says **Incorrect family access code**, check the Cloudflare secret and that both phones use the exact same code.
- If connecting says **Server error**, verify the D1 database ID and the `schema.sql` execution on the remote database.
- If the recipe link fails, it may be unsupported or blocked; add it manually. Importing works best for pages with JSON-LD structured recipe data.
- Keep your Worker URL private-ish and the access code genuinely private; use GitHub Pages for *hosting the app*, not for storing household recipe data.

## Starter recipe source and credits

The included macaroni-and-cheese recipe is a concise, attributed adaptation of the directions and ingredients from [Key to My Lime: Velveeta Mac and Cheese](https://keytomylime.com/velveeta-mac-and-cheese-recipe/). Visit the source for the author's original presentation and content.

## Local development

Serve the directory with a local web server (don't open `index.html` via `file://` if you want offline/PWA behavior):

```bash
python -m http.server 8000
```

Visit `http://localhost:8000`. No Node or framework build is needed for the frontend. To develop/test Cloudflare Worker functionality locally, use `cd worker && npx wrangler dev` after configuring the database binding.
