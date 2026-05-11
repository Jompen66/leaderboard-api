export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = "appPVgKKVrm0scfIi";
  const TABLE_ID = "tblvawwsDpRhpRBDp";

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({
      error: "Missing AIRTABLE_API_KEY",
    });
  }

  function first(value) {
    return Array.isArray(value) ? value[0] : value;
  }

  try {
    const { playerId, status, matchId } = req.query;

    const filters = [];

    if (playerId) {
      filters.push(`FIND('${playerId}', ARRAYJOIN({Spelare}))`);
    }

    if (status) {
      filters.push(`{Status}='${status}'`);
    }

    if (matchId) {
      filters.push(`{Match Id}='${matchId}'`);
    }

    const formula = filters.length
      ? `AND(${filters.join(",")})`
      : "";

    const fields = [
      "Match Id",
      "Spelare",
      "Sida",
      "Status",
      "Deadline",
      "Speldatum",
      "Bana",
      "Resultattext",
      "Resultattyp",
      "Matchtyp",
      "Matchvisning",
      "Primärfält",
      "Sida A namn",
      "Sida B namn",
    ];

    let allRecords = [];
    let offset = "";

    do {
      const url = new URL(
        `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`
      );

      if (formula) {
        url.searchParams.set("filterByFormula", formula);
      }

      url.searchParams.set("cellFormat", "string");
      url.searchParams.set("timeZone", "Europe/Stockholm");
      url.searchParams.set("userLocale", "sv");

      fields.forEach((field) => {
        url.searchParams.append("fields[]", field);
      });

      if (offset) {
        url.searchParams.set("offset", offset);
      }

      const airtableRes = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      const text = await airtableRes.text();

      if (!airtableRes.ok) {
        return res.status(500).json({
          error: "Airtable request failed",
          details: text,
        });
      }

      const data = JSON.parse(text);

      allRecords = allRecords.concat(data.records || []);
      offset = data.offset || "";
    } while (offset);

    const cleanedRecords = allRecords.map((record) => {
      const f = record.fields || {};

      return {
        id: record.id,
        fields: {
          ...f,

          "Match Id": first(f["Match Id"]),
          "Spelare": first(f["Spelare"]),
          "Sida": first(f["Sida"]),
          "Status": first(f["Status"]),
          "Deadline": first(f["Deadline"]),
          "Speldatum": first(f["Speldatum"]),
          "Bana": first(f["Bana"]),
          "Resultattext": first(f["Resultattext"]),
          "Resultattyp": first(f["Resultattyp"]),
          "Matchtyp": first(f["Matchtyp"]),
          "Matchvisning": first(f["Matchvisning"]),
          "Primärfält": first(f["Primärfält"]),

          // 🔥 DETTA FIXAR recXXXX-PROBLEMET
          "Sida A namn": first(f["Sida A namn"]) || "",
          "Sida B namn": first(f["Sida B namn"]) || "",
        },
      };
    });

    cleanedRecords.sort((a, b) => {
      const da = a.fields?.Deadline || "";
      const db = b.fields?.Deadline || "";
      return da.localeCompare(db);
    });

    return res.status(200).json({
      records: cleanedRecords,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      details: error.message,
    });
  }
}
