export default async function handler(req, res) {
  const API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = "appPVgKKVrm0scfIi";
  const TABLE_ID = "tblQUvfLh6unvSVWW";

  try {
    const response = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}`,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
      }
    );

    const data = await response.json();

    const records = (data.records || []).sort((a, b) => {
      const aVal = Number(a.fields["Totalpoäng"] || 0);
      const bVal = Number(b.fields["Totalpoäng"] || 0);
      return bVal - aVal;
    });

    res.status(200).json(records);
  } catch (err) {
    res.status(500).json({ error: "Fel vid hämtning" });
  }
}
