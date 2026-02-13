/**
 * Triggers content ingestion by POSTing to the /api/ingest endpoint.
 *
 * Required env vars:
 *   HOST_URL            – base URL of the deployed app
 *   INGEST_SECRET_CODE  – shared secret sent in the x-ingest-secret header
 */

const HOST_URL = process.env.HOST_URL;
const INGEST_SECRET_CODE = process.env.INGEST_SECRET_CODE;

if (!HOST_URL) {
  console.error("Error: HOST_URL environment variable is not set");
  process.exit(1);
}

if (!INGEST_SECRET_CODE) {
  console.error("Error: INGEST_SECRET_CODE environment variable is not set");
  process.exit(1);
}

async function main() {
  const url = `${HOST_URL}/api/ingest`;
  console.log(`Triggering ingestion at ${url} ...`);

  const response = await fetch(url, {
    method: "POST",
    headers: { "x-ingest-secret": INGEST_SECRET_CODE! },
  });

  const body = await response.text();

  if (!response.ok) {
    console.error(`Ingestion failed (HTTP ${response.status})`);
    console.error(body);
    process.exit(1);
  }

  console.log(`Ingestion succeeded (HTTP ${response.status})`);
  console.log(body);
}

main();
