const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = "appPVgKKVrm0scfIi";

const MATCHES_TABLE_NAME = "tbl31EaibzeDRmDlT";
const MATCHDELTAGARE_TABLE_NAME = "tblvawwsDpRhpRBDp";

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "https://elisha42095.softr.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function fetchAllRecords(tableName, filterFormula = "") {
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

    const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(tableName)}?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      },
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`Airtable fetch error (${tableName}): ${response.status} ${text}`);
    }

    const data = JSON.parse(text);
    allRecords = allRecords.concat(data.records || []);
    offset = data.offset;
  } while (offset);

  return allRecords;
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { matchId, bana, speldatum, resultattyp, resultattext } = req.body || {};

    if (!matchId) {
      return res.status(400).json({ error: "Missing matchId" });
    }

    if (!bana || !speldatum || !resultattyp || !resultattext) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["matchId", "bana", "speldatum", "resultattyp", "resultattext"],
      });
    }

    const matchFilter = `RECORD_ID()='${matchId}'`;
    const matchRecords = await fetchAllRecords(MATCHES_TABLE_NAME, matchFilter);

    if (!matchRecords.length) {
      return res.status(404).json({ error: "Match not found" });
    }

    const participantsFilter = `{Match Id}='${matchId}'`;
    const participantRecords = await fetchAllRecords(MATCHDELTAGARE_TABLE_NAME, participantsFilter);

    if (participantRecords.length !== 2) {
      return res.status(400).json({
        error: "Expected exactly 2 participant rows",
        found: participantRecords.length,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "POST works, fetch works, but no Airtable fields updated yet",
      matchId,
      participantIdsFound: participantRecords.map((r) => r.id),
      submittedValues: { bana, speldatum, resultattyp, resultattext }
    });
  } catch (error) {
    console.error("report-match error:", error);

    return res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
}
