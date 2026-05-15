export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=60, stale-while-revalidate=120"
  );

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = "appPVgKKVrm0scfIi";

  const PLAYERS_TABLE_ID = "tblQUvfLh6unvSVWW";
  const SAMMANDRAG_TABLE = "tblOQQYoV7eksJQWF";

  if (!AIRTABLE_API_KEY) {
    return res.status(500).json({
      error: "Missing AIRTABLE_API_KEY in environment variables",
    });
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

  function bonusForEvents(count) {
    if (count >= 6) return 18;
    if (count >= 5) return 6;
    if (count >= 4) return 2;
    return 0;
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

  function first(value) {
    return Array.isArray(value) ? value[0] : value;
  }

  function calculateEventPoints(results) {
    if (!results.length) return [];

    const format = results[0].Spelform || "";
    const lowerIsBetter = format.toLowerCase().includes("slag");

    const sorted = [...results].sort((a, b) => {
      const scoreA = numberValue(a.Resultat);
      const scoreB = numberValue(b.Resultat);

      return lowerIsBetter ? scoreA - scoreB : scoreB - scoreA;
    });

    const calculated = [];
    let index = 0;

    while (index < sorted.length) {
      const currentScore = numberValue(sorted[index].Resultat);
      const tieGroup = [sorted[index]];

      let next = index + 1;

      while (
        next < sorted.length &&
        numberValue(sorted[next].Resultat) === currentScore
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
        const signatureBonus = isTruthy(row.EventSignatur) ? 5 : 0;

        calculated.push({
          ...row,
          Placering: startPlace,
          Baspoäng: basePoints,
          Signaturbonus: signatureBonus,
          Poäng: basePoints + signatureBonus,
        });
      }

      index = next;
    }

    return calculated;
  }

  async function fetchAllRecords(table, fields = []) {
    let allRecords = [];
    let offset = null;

    do {
      const params = new URLSearchParams();

      fields.forEach((field) => {
        params.append("fields[]", field);
      });

      if (offset) {
        params.append("offset", offset);
      }

      const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(
        table
      )}?${params.toString()}`;

      const airtableRes = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
      });

      const rawText = await airtableRes.text();

      if (!airtableRes.ok) {
        throw new Error(
          `Airtable request failed for ${table}: ${airtableRes.status} ${rawText}`
        );
      }

      const data = JSON.parse(rawText);

      allRecords = allRecords.concat(data.records || []);
      offset = data.offset;
    } while (offset);

    return allRecords;
  }

  try {
    const players = await fetchAllRecords(PLAYERS_TABLE_ID, [
      "Spelare",
      "Matchpoäng Total",
      "Profilbild",
      "Historiska totalvinster",
    ]);

    const sammandragResultat = await fetchAllRecords(SAMMANDRAG_TABLE, [
      "Spelare",
      "Event",
      "Score",
      "Spelform",
      "EventSignatur",
      "Vinflaskor",
      "Närmast hål",
      "Längsta drive",
    ]);

    const resultRows = sammandragResultat
      .map((record) => {
        const fields = record.fields || {};

        return {
          id: record.id,
          Spelare: first(fields["Spelare"]),
          Sammandrag: first(fields["Event"]),
          Resultat: fields["Score"],
          Spelform: first(fields["Spelform"]) || "",
          EventSignatur: fields["EventSignatur"],
          Vinflaskor: numberValue(fields["Vinflaskor"]),
          NarmastHal: numberValue(fields["Närmast hål"]),
          LangstaDrive: numberValue(fields["Längsta drive"]),
        };
      })
      .filter(
        (row) =>
          row.Spelare &&
          row.Sammandrag &&
          row.Resultat !== null &&
          row.Resultat !== undefined &&
          row.Resultat !== ""
      );

    const resultsByEvent = {};

    for (const row of resultRows) {
      if (!resultsByEvent[row.Sammandrag]) {
        resultsByEvent[row.Sammandrag] = [];
      }

      resultsByEvent[row.Sammandrag].push(row);
    }

    let calculatedResults = [];

    for (const eventId of Object.keys(resultsByEvent)) {
      calculatedResults = calculatedResults.concat(
        calculateEventPoints(resultsByEvent[eventId])
      );
    }

    const pointsByPlayer = {};

    for (const row of calculatedResults) {
      if (!pointsByPlayer[row.Spelare]) {
        pointsByPlayer[row.Spelare] = {
          poangSammandrag: 0,
          antalSammandrag: 0,
          vinflaskor: 0,
          narmastHal: 0,
          langstaDrive: 0,
        };
      }

      pointsByPlayer[row.Spelare].poangSammandrag += row.Poäng;
      pointsByPlayer[row.Spelare].antalSammandrag += 1;
      pointsByPlayer[row.Spelare].vinflaskor += numberValue(row.Vinflaskor);
      pointsByPlayer[row.Spelare].narmastHal += numberValue(row.NarmastHal);
      pointsByPlayer[row.Spelare].langstaDrive += numberValue(row.LangstaDrive);
    }

    const leaderboard = players.map((player) => {
      const fields = player.fields || {};

      const sammandragStats = pointsByPlayer[player.id] || {
        poangSammandrag: 0,
        antalSammandrag: 0,
        vinflaskor: 0,
        narmastHal: 0,
        langstaDrive: 0,
      };

      const antalSammandrag = sammandragStats.antalSammandrag;
      const bonuspoang = bonusForEvents(antalSammandrag);
      const matchpoang = numberValue(fields["Matchpoäng Total"]);
      const poangSammandrag = sammandragStats.poangSammandrag;
      const totalpoang = poangSammandrag + bonuspoang + matchpoang;

      return {
        id: player.id,
        createdTime: player.createdTime,
        fields: {
          ...fields,

          "Poäng Sammandrag": poangSammandrag,
          "Antal Sammandrag": antalSammandrag,
          Bonuspoäng: bonuspoang,
          "Matchpoäng Total": matchpoang,
          Totalpoäng: totalpoang,

          "Vinflaskor Totalt": sammandragStats.vinflaskor,
          "Närmast hål Totalt": sammandragStats.narmastHal,
          "Längsta drive Totalt": sammandragStats.langstaDrive,
        },
      };
    });

    leaderboard.sort((a, b) => {
      return numberValue(b.fields.Totalpoäng) - numberValue(a.fields.Totalpoäng);
    });

    return res.status(200).json({
      records: leaderboard,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Server error while fetching leaderboard",
      details: error.message,
    });
  }
}
