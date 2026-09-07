import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Module-level caches (persist across requests within same isolate) ──

let cachedServiceAccount: any = null;
let cachedCryptoKey: CryptoKey | null = null;

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0; // unix seconds

let cachedSchema: any = null;
let schemaFetchedAt = 0;
const SCHEMA_TTL_MS = 60 * 60 * 1000; // 1 hour

function getServiceAccount(): any {
  if (cachedServiceAccount) {
    console.log("service account cache hit");
    return cachedServiceAccount;
  }
  const raw = Deno.env.get("BIGQUERY_SERVICE_ACCOUNT_KEY");
  if (!raw) throw new Error("BIGQUERY_SERVICE_ACCOUNT_KEY is not configured");

  let keyToParse = raw.trim();
  try {
    cachedServiceAccount = JSON.parse(keyToParse);
    if (typeof cachedServiceAccount === "string") {
      cachedServiceAccount = JSON.parse(cachedServiceAccount);
    }
  } catch (parseErr) {
    try {
      cachedServiceAccount = JSON.parse(atob(keyToParse));
    } catch {
      console.error("JSON parse error. Key length:", keyToParse.length, "First 20 chars:", keyToParse.substring(0, 20));
      throw new Error(`Failed to parse service account key: ${parseErr}`);
    }
  }
  return cachedServiceAccount;
}

async function getCryptoKey(serviceAccount: any): Promise<CryptoKey> {
  if (cachedCryptoKey) {
    console.log("crypto key cache hit");
    return cachedCryptoKey;
  }
  const pemContents = serviceAccount.private_key
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\n/g, "");
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

  cachedCryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return cachedCryptoKey;
}

async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  // Reuse token if still valid (with 60s buffer)
  if (cachedAccessToken && now < tokenExpiresAt - 60) {
    console.log("token cache hit");
    return cachedAccessToken;
  }

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/bigquery.readonly",
    aud: serviceAccount.token_uri,
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: any) => {
    const json = JSON.stringify(obj);
    return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const cryptoKey = await getCryptoKey(serviceAccount);

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${unsignedToken}.${signatureB64}`;

  const tokenResponse = await fetch(serviceAccount.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!tokenResponse.ok) {
    const errText = await tokenResponse.text();
    throw new Error(`Token exchange failed [${tokenResponse.status}]: ${errText}`);
  }

  const tokenData = await tokenResponse.json();
  cachedAccessToken = tokenData.access_token;
  tokenExpiresAt = now + (tokenData.expires_in || 3600);
  return cachedAccessToken!;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceAccount = getServiceAccount();
    const accessToken = await getAccessToken(serviceAccount);
    const bqProject = "wavemaker-mena-groupm";

    const { query, action } = await req.json();

    if (action === "get_schema") {
      // Return cached schema if fresh
      if (cachedSchema && Date.now() - schemaFetchedAt < SCHEMA_TTL_MS) {
        console.log("schema cache hit");
        return new Response(JSON.stringify({ schema: cachedSchema }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const resp = await fetch(
        `https://bigquery.googleapis.com/bigquery/v2/projects/${bqProject}/datasets/Nestle/tables/Nestle_main_media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`BigQuery schema fetch failed [${resp.status}]: ${errText}`);
      }
      const data = await resp.json();
      cachedSchema = data.schema;
      schemaFetchedAt = Date.now();
      return new Response(JSON.stringify({ schema: cachedSchema }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!query) throw new Error("No query provided");

    const trimmed = query.trim().toUpperCase();
    if (!trimmed.startsWith("SELECT") && !trimmed.startsWith("WITH")) {
      throw new Error("Only SELECT queries are allowed");
    }

    const bqResponse = await fetch(
      `https://bigquery.googleapis.com/bigquery/v2/projects/${bqProject}/queries`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          useLegacySql: false,
          maxResults: 1000,
          useQueryCache: true,
          timeoutMs: 30000,
        }),
      }
    );

    if (!bqResponse.ok) {
      const errText = await bqResponse.text();
      throw new Error(`BigQuery query failed [${bqResponse.status}]: ${errText}`);
    }

    const result = await bqResponse.json();
    const fields = result.schema?.fields?.map((f: any) => f.name) || [];
    const rows = result.rows?.map((row: any) =>
      Object.fromEntries(row.f.map((cell: any, i: number) => [fields[i], cell.v]))
    ) || [];

    return new Response(
      JSON.stringify({ fields, rows, totalRows: result.totalRows, jobComplete: result.jobComplete }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("BigQuery error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
