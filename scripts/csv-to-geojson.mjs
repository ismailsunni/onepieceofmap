/**
 * Converts public/data.csv → public/data.geojson
 * Run: npm run csv-to-geojson
 *
 * CSV columns: name, onePieceWikia, realWorldLocation, wikipedia, longitude, latitude
 */
import { readFileSync, writeFileSync } from "fs";
import Papa from "papaparse";
const { parse } = Papa;

const csv = readFileSync("public/data.csv", "utf8");
const { data, errors } = parse(csv, { header: true, skipEmptyLines: true });

if (errors.length) {
  console.error("CSV parse errors:", errors);
  process.exit(1);
}

const geojson = {
  type: "FeatureCollection",
  features: data.map((row) => ({
    type: "Feature",
    properties: {
      name: row.name,
      onePieceWikia: row.onePieceWikia,
      realWorldLocation: row.realWorldLocation,
      wikipedia: row.wikipedia,
    },
    geometry: {
      type: "Point",
      coordinates: [parseFloat(row.longitude), parseFloat(row.latitude)],
    },
  })),
};

writeFileSync("public/data.geojson", JSON.stringify(geojson, null, 2) + "\n");
console.log(`Converted ${data.length} rows → public/data.geojson`);
