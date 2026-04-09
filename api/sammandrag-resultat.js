const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = "appPVgKKVrm0scfIi";

const SAMMANDRAG_RESULTAT_TABLE_ID = "tblOQQYoV7eksJQWF";

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function fetchAllRecords(tableId, filterFormula = "") {
  let allRecords = [];
  let offset = null;

  do {
    const params = new URLSearchParams();
    params.append("cellFormat", "string");
    params.append("timeZone", "Europe/Stockholm");
    params.append("userLocale", "sv");

    if (filterFormula) {
      params.append("filterByFormula", filterFormula);
    }

    if (offset) {
      params.append("offset", offset);
    }

    const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(tableId)}?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      },
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Airtable error (${tableId}): ${response.status} ${text}`);
    }

    const data = JSON.parse(text);
    allRecords = allRecords.concat(data.records || []);
    offset = data.offset;
  } while (offset);

  return allRecords;
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { eventId } = req.query;

    if (!eventId) {
      return res.status(400).json({ error: "Missing eventId" });
    }

const filterFormula = `FIND('${eventId}', ARRAYJOIN({Event}))`;
    const records = await fetchAllRecords(SAMMANDRAG_RESULTAT_TABLE_ID, filterFormula);

    const results = records.map((record) => {
      const f = record.fields || {};

      return {
        airtableRecordId: record.id,
        event: first(f["Event"]),
        spelare: first(f["Spelare"]) || "",
        spelform: first(f["Spelform"]) || "",
        placering: first(f["Placering"]),
        score: first(f["Score"]),
        poangSammandrag: first(f["Poäng Sammandrag"]),
        bana: first(f["Bana (från Event)"]) || "",
      };
    });

    results.sort((a, b) => {
      const pa = Number(a.placering ?? 9999);
      const pb = Number(b.placering ?? 9999);
      if (pa !== pb) return pa - pb;

      const sa = Number(a.score ?? 9999);
      const sb = Number(b.score ?? 9999);
      return sa - sb;
    });

    return res.status(200).json({
      ok: true,
      eventId,
      results,
    });
  } catch (error) {
    console.error("sammandrag-resultat error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
}	
