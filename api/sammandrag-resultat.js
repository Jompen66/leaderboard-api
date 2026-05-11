const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = "appPVgKKVrm0scfIi";

const SAMMANDRAG_RESULTAT_TABLE_ID = "tblOQQYoV7eksJQWF";

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}

function numberValue(value) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function isTruthy(value) {
  if (value === true) return true;

  if (Array.isArray(value)) {
    return value.some(isTruthy);
  }

  if (typeof value === "string") {
    const text = value.toLowerCase();
    return (
      text === "true" ||
      text === "1" ||
      text === "yes" ||
      text === "ja" ||
      text.includes("signatur")
    );
  }

  return false;
}

function pointsForPlace(place) {
  if (place === 1) return 26;
  if (place === 2) return 23;
  if (place === 3) return 20;
  if (place === 4) return 18;
  if (place === 5) return 16;
  if (place === 6) return 14;
  if (place === 7) return 12;
  if (place === 8) return 10;
  if (place >= 9 && place <= 12) return 8;
  if (place === 13) return 5;
  if (place === 14) return 3;
  return 1;
}

function calculateEventPoints(results) {
  if (!results.length) return [];

  const format = results[0].spelform || "";
  const lowerIsBetter = format.toLowerCase().includes("slag");

  const sorted = [...results].sort((a, b) => {
    const scoreA = numberValue(a.score);
    const scoreB = numberValue(b.score);

    return lowerIsBetter ? scoreA - scoreB : scoreB - scoreA;
  });

  const calculated = [];
  let index = 0;

  while (index < sorted.length) {
    const currentScore = numberValue(sorted[index].score);
    const tieGroup = [sorted[index]];

    let next = index + 1;

    while (
      next < sorted.length &&
      numberValue(sorted[next].score) === currentScore
    ) {
      tieGroup.push(sorted[next]);
      next++;
    }

    const startPlace = index + 1;
    const endPlace = index + tieGroup.length;

    let totalBasePoints = 0;

    for (let place = startPlace; place <= endPlace; place++) {
      totalBasePoints += pointsForPlace(place);
    }

    const basePoints = totalBasePoints / tieGroup.length;

    for (const row of tieGroup) {
      const signaturbonus = isTruthy(row.eventSignatur) ? 5 : 0;

      calculated.push({
        ...row,
        placering: startPlace,
        baspoang: basePoints,
        signaturbonus,
        poangSammandrag: basePoints + signaturbonus,
      });
    }

    index = next;
  }

  return calculated;
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

    params.append("fields[]", "Event");
    params.append("fields[]", "Event Record ID");
    params.append("fields[]", "Spelare");
    params.append("fields[]", "Score");
    params.append("fields[]", "Spelform");
    params.append("fields[]", "EventSignatur");
  
    if (offset) {
      params.append("offset", offset);
    }

    const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(
      tableId
    )}?${params.toString()}`;

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

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({
      error: "Missing AIRTABLE_API_KEY",
    });
  }

  try {
    const { eventId } = req.query;

    if (!eventId) {
      return res.status(400).json({ error: "Missing eventId" });
    }

    const filterFormula = `{Event Record ID}='${eventId}'`;
    const records = await fetchAllRecords(
      SAMMANDRAG_RESULTAT_TABLE_ID,
      filterFormula
    );

    const rawResults = records
      .map((record) => {
        const f = record.fields || {};

        return {
          airtableRecordId: record.id,
          event: first(f["Event"]),
          spelare: first(f["Spelare"]) || "",
          spelform: first(f["Spelform"]) || "",
          score: first(f["Score"]),
          eventSignatur: f["EventSignatur"],
          bana: "",
        };
      })
      .filter(
        (row) =>
          row.spelare &&
          row.score !== null &&
          row.score !== undefined &&
          row.score !== ""
      );

    const results = calculateEventPoints(rawResults);

    results.sort((a, b) => {
      const pa = numberValue(a.poangSammandrag);
      const pb = numberValue(b.poangSammandrag);

      if (pb !== pa) return pb - pa;

      const pla = numberValue(a.placering || 999);
      const plb = numberValue(b.placering || 999);

      return pla - plb;
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
