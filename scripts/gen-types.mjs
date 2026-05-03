// Regenerates src/types/database.ts from the live Supabase project.
// Run via: npm run gen:types
// Requires SUPABASE_ACCESS_TOKEN in .env.local (get one from
// https://supabase.com/dashboard/account/tokens) and a NEXT_PUBLIC_SUPABASE_URL.

import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!url) {
  console.error(
    "NEXT_PUBLIC_SUPABASE_URL is not set. Add it to .env.local and re-run.",
  );
  process.exit(1);
}
if (!process.env.SUPABASE_ACCESS_TOKEN) {
  console.error(
    "SUPABASE_ACCESS_TOKEN is not set. Create one at\n" +
      "  https://supabase.com/dashboard/account/tokens\n" +
      "then add SUPABASE_ACCESS_TOKEN=... to .env.local and re-run.",
  );
  process.exit(1);
}

const projectRef = new URL(url).hostname.split(".")[0];

const output = execSync(
  `npx --yes supabase gen types typescript --project-id ${projectRef} --schema palaro`,
  { stdio: ["inherit", "pipe", "inherit"] },
);

writeFileSync("src/types/database.ts", output);
console.log(`Wrote src/types/database.ts (palaro schema, project ${projectRef}).`);
