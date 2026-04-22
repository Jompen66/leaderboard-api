const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = "appPVgKKVrm0scfIi";

const BETS_TABLE_ID = "tblNxsTdymYZJU9Qj";

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function fetchAllRecords(tableId, filterFormula = "", fields = []) {
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

    fields.forEach((field) => {
      params.append("fields[]", field);
    });

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
  res.setHeader("Cache-Control", "public, s-maxage=120, stale-while-revalidate=300");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { playerId, season } = req.query;

    const filters = [];

    if (playerId) {
      filters.push(
        `OR({Spelare Record ID}='${playerId}', {Förlorare Record ID}='${playerId}')`
      );
    }

    if (season) {
      filters.push(`{Säsong}='${season}'`);
    }

    const filterFormula = filters.length ? `AND(${filters.join(",")})` : "";

    const records = await fetchAllRecords(BETS_TABLE_ID, filterFormula, [
      "Bett",
      "Spelare",
      "Förlorare",
      "Spelare Record ID",
      "Förlorare Record ID",
      "Datum",
      "Utfall",
      "Beskrivning",
      "Säsong",
      "Reglerad",
      "RecordID"
    ]);

    const bets = records.map((record) => {
      const f = record.fields || {};

      return {
        airtableRecordId: record.id,
        recordId: first(f["RecordID"]) || record.id,
        bett: first(f["Bett"]) || "",
        spelare: first(f["Spelare"]) || "",
        forlorare: first(f["Förlorare"]) || "",
        datum: first(f["Datum"]) || "",
        utfall: first(f["Utfall"]) || "",
        beskrivning: first(f["Beskrivning"]) || "",
        sasong: first(f["Säsong"]) || "",
        reglerad: !!first(f["Reglerad"])
      };
    });

    bets.sort((a, b) => new Date(b.datum || 0) - new Date(a.datum || 0));

    return res.status(200).json({
      ok: true,
      bets
    });
  } catch (error) {
    console.error("bets error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error.message
    });
  }
}
