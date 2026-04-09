const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = "appPVgKKVrm0scfIi";

const MATCHES_TABLE_NAME = "tbl31EaibzeDRmDlT";
const MATCHDELTAGARE_TABLE_NAME = "tblvawwsDpRhpRBDp";

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
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

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Airtable error (${tableName}): ${response.status} ${errorText}`);
    }

    const data = await response.json();
    allRecords = allRecords.concat(data.records || []);
    offset = data.offset;
  } while (offset);

  return allRecords;
}

function val(value) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
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
    const { matchId } = req.query;

    if (!matchId) {
      return res.status(400).json({ error: "Missing matchId" });
    }

    const matchFilter = `RECORD_ID()='${matchId}'`;
    const matchRecords = await fetchAllRecords(MATCHES_TABLE_NAME, matchFilter);

    if (!matchRecords.length) {
      return res.status(404).json({ error: "Match not found" });
    }

    const matchRecord = matchRecords[0];
    const m = matchRecord.fields || {};

    const participantsFilter = `{Match Id}='${matchId}'`;
    const participantRecords = await fetchAllRecords(MATCHDELTAGARE_TABLE_NAME, participantsFilter);

    const participants = participantRecords.map((record) => {
      const f = record.fields || {};

      return {
        airtableRecordId: record.id,
        recordId: val(f["Record Id"]) || record.id,
        matchId: val(f["Match Id"]),
        match: val(f["Match"]),
        spelare: val(f["Spelare"]),
        sida: val(f["Sida"]),
        status: val(f["Status"]),
        deadline: val(f["Deadline"]),
        matchtyp: val(f["Matchtyp"]),
        bana: val(f["Bana"]),
        speldatum: val(f["Speldatum"]),
        resultattyp: val(f["Resultattyp"]),
        resultattext: val(f["Resultattext"]),
        sidaANamn: val(f["Sida A namn"]),
        sidaBNamn: val(f["Sida B namn"]),
      };
    });

    participants.sort((a, b) => {
      if (a.sida === "A" && b.sida === "B") return -1;
      if (a.sida === "B" && b.sida === "A") return 1;
      return 0;
    });

    const match = {
      airtableRecordId: matchRecord.id,
      recordId: val(m["Record ID"]) || matchRecord.id,
      match: val(m["Match"]),
      matchId: val(m["Record ID"]) || matchRecord.id,
      matchtyp: val(m["Matchtyp"]),
      sidaANamn: val(m["Sida A namn"]),
      sidaBNamn: val(m["Sida B namn"]),
      deadline: val(m["Deadline"]),
      status: val(m["Status"]),
      bana: val(m["Bana"]),
      speldatum: val(m["Speldatum"]),
      resultattyp: val(m["Resultattyp"]),
      resultattext: val(m["Resultattext"]),
      visningsnamn: val(m["Visningsnamn"]),
      schemaInfo: val(m["Schema-info"]),
      resultatInfo: val(m["Resultat-info"]),
    };

    return res.status(200).json({
      ok: true,
      match,
      participants,
    });
  } catch (error) {
    console.error("match-report error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
}
