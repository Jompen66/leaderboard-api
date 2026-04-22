const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = "appPVgKKVrm0scfIi";

const BETS_TABLE_ID = "tblNxsTdymYZJU9Qj";

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function createRecord(tableId, fields) {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(tableId)}`;

  const payload = {
    fields,
    typecast: true
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Airtable create error (${tableId}): ${response.status} ${text}`);
  }

  return JSON.parse(text);
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
    const {
      spelareRecordId,
      forlorareRecordId,
      datum,
      utfall,
      beskrivning,
      bett,
      sasong,
      reglerad
    } = req.body || {};

    if (!spelareRecordId || !datum || !utfall || !beskrivning) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["spelareRecordId", "datum", "utfall", "beskrivning"]
      });
    }

    const fields = {
      "Bett": bett || beskrivning,
      "Spelare": [spelareRecordId],
      "Datum": datum,
      "Utfall": utfall,
      "Beskrivning": beskrivning,
      "Säsong": sasong || "2026",
      "Reglerad": !!reglerad
    };

    if (forlorareRecordId) {
      fields["Förlorare"] = [forlorareRecordId];
    }

    const created = await createRecord(BETS_TABLE_ID, fields);

    return res.status(200).json({
      ok: true,
      message: "Bet registered successfully",
      recordId: created.id
    });
  } catch (error) {
    console.error("report-bet error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error.message
    });
  }
}

  if (!response.ok) {
    throw new Error(`Airtable create error (${tableId}): ${response.status} ${text}`);
  }

  return JSON.parse(text);
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
    const { spelareRecordId, datum, utfall, beskrivning, bett, sasong, reglerad } = req.body || {};

    if (!spelareRecordId || !datum || !utfall || !beskrivning) {
      return res.status(400).json({
        error: "Missing required fields",
        required: ["spelareRecordId", "datum", "utfall", "beskrivning"]
      });
    }

    const fields = {
      "Bett": bett || beskrivning,
      "Spelare": [spelareRecordId],
      "Datum": datum,
      "Utfall": utfall,
      "Beskrivning": beskrivning,
      "Säsong": sasong || "2026",
      "Reglerad": !!reglerad
    };

    const created = await createRecord(BETS_TABLE_ID, fields);

    return res.status(200).json({
      ok: true,
      message: "Bet registered successfully",
      recordId: created.id
    });
  } catch (error) {
    console.error("report-bet error:", error);
    return res.status(500).json({
      error: "Internal server error",
      details: error.message
    });
  }
}
