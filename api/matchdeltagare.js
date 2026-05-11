export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = "appPVgKKVrm0scfIi";

  const MATCHDELTAGARE_TABLE_ID = "tblvawwsDpRhpRBDp";
  const PLAYERS_TABLE_ID = "tblQUvfLh6unvSVWW";

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({ error: "Missing AIRTABLE_API_KEY" });
  }

  async function fetchAllRecords(tableId, fields = [], filterFormula = "") {
    let allRecords = [];
    let offset = "";

    do {
      const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${tableId}`);

      if (filterFormula) url.searchParams.set("filterByFormula", filterFormula);
      if (offset) url.searchParams.set("offset", offset);

      fields.forEach((field) => {
        url.searchParams.append("fields[]", field);
      });

      const airtableRes = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      const rawText = await airtableRes.text();

      if (!airtableRes.ok) {
        throw new Error(`Airtable error ${airtableRes.status}: ${rawText}`);
      }

      const data = JSON.parse(rawText);
      allRecords = allRecords.concat(data.records || []);
      offset = data.offset || "";
    } while (offset);

    return allRecords;
  }

  function mapIdsToNames(value, playerNameById) {
    if (!value) return value;

    if (Array.isArray(value)) {
      return value.map((item) => playerNameById[item] || item);
    }

    return playerNameById[value] || value;
  }

  try {
    const { playerId, status, matchId } = req.query;

    const filters = [];

    if (playerId) filters.push(`FIND('${playerId}', ARRAYJOIN({Spelare}))`);
    if (status) filters.push(`{Status}='${status}'`);
    if (matchId) filters.push(`{Match Id}='${matchId}'`);

    const formula = filters.length ? `AND(${filters.join(",")})` : "";

    const players = await fetchAllRecords(PLAYERS_TABLE_ID, ["Spelare"]);

    const playerNameById = {};
    players.forEach((player) => {
      playerNameById[player.id] = player.fields?.Spelare || player.id;
    });

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

    const allRecords = await fetchAllRecords(
      MATCHDELTAGARE_TABLE_ID,
      fields,
      formula
    );

    const fixedRecords = allRecords.map((record) => {
      const f = record.fields || {};

      return {
        ...record,
        fields: {
          ...f,
          "Sida A namn": mapIdsToNames(f["Sida A namn"], playerNameById),
          "Sida B namn": mapIdsToNames(f["Sida B namn"], playerNameById),
        },
      };
    });

    return res.status(200).json({
      records: fixedRecords,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Server error while fetching Matchdeltagare",
      details: error.message,
    });
  }
}
