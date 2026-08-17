const fs = require("fs");
const path = require("path");

const SOURCE_DIR = path.join(
  __dirname,
  "aklan-boundary-source",
  "2023",
  "geojson",
  "municities",
  "medres"
);

const OUTPUT_DIR = path.join(
  __dirname,
  "public",
  "geojson"
);

const MUNICIPALITIES = {
  "600401000": "Altavas",
  "600402000": "Balete",
  "600403000": "Banga",
  "600404000": "Batan",
  "600405000": "Buruanga",
  "600406000": "Ibajay",
  "600407000": "Kalibo",
  "600408000": "Lezo",
  "600409000": "Libacao",
  "600410000": "Madalag",
  "600411000": "Makato",
  "600412000": "Malay",
  "600413000": "Malinao",
  "600414000": "Nabas",
  "600415000": "New Washington",
  "600416000": "Numancia",
  "600417000": "Tangalan"
};

const AKLAN_PROVINCE_CODE = "600400000";

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const barangayFeatures = [];
const municipalityFeatures = [];

for (const [municipalityCode, municipalityName] of Object.entries(
  MUNICIPALITIES
)) {
  const filename =
    `bgysubmuns-municity-${municipalityCode}.0.01.json`;

  const filePath = path.join(SOURCE_DIR, filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Missing Aklan source file: ${filename}`
    );
  }

  const data = JSON.parse(
    fs.readFileSync(filePath, "utf8")
  );

  if (
    data.type !== "FeatureCollection" ||
    !Array.isArray(data.features)
  ) {
    throw new Error(
      `Invalid GeoJSON structure: ${filename}`
    );
  }

  /*
   * Every feature in these files represents
   * a barangay polygon.
   */
  for (const feature of data.features) {
    const properties = feature.properties || {};

    barangayFeatures.push({
      ...feature,
      properties: {
        ...properties,
        province: "Aklan",
        municipality: municipalityName,
        municipality_psgc: municipalityCode,
        flood_status: "normal"
      }
    });
  }

  /*
   * Create a municipality polygon by combining
   * the barangay geometries.
   *
   * The actual geometry is generated later by
   * dissolving the barangay boundaries.
   *
   * For now we store the municipality metadata.
   */
  municipalityFeatures.push({
    type: "Feature",
    properties: {
      province: "Aklan",
      municipality: municipalityName,
      municipality_psgc: municipalityCode,
      barangay_count: data.features.length,
      flood_status: "normal"
    },
    geometry: null
  });
}

/*
 * Verify that every selected file belongs
 * to the Aklan province group.
 */
for (const feature of barangayFeatures) {
  const adm2 = String(
    feature.properties?.adm2_psgc
  );

  if (adm2 !== AKLAN_PROVINCE_CODE) {
    throw new Error(
      `Non-Aklan feature detected: adm2_psgc=${adm2}`
    );
  }
}

const barangayGeoJSON = {
  type: "FeatureCollection",
  name: "Aklan Barangays",
  features: barangayFeatures
};

const municipalityMetadata = {
  type: "FeatureCollection",
  name: "Aklan Municipalities Metadata",
  features: municipalityFeatures
};

const barangayOutput = path.join(
  OUTPUT_DIR,
  "aklan-barangays.geojson"
);

const municipalityOutput = path.join(
  OUTPUT_DIR,
  "aklan-municipalities-metadata.geojson"
);

fs.writeFileSync(
  barangayOutput,
  JSON.stringify(barangayGeoJSON)
);

fs.writeFileSync(
  municipalityOutput,
  JSON.stringify(municipalityMetadata)
);

console.log("");
console.log("======================================");
console.log("       FLOODGUARD AKLAN GEOJSON");
console.log("======================================");
console.log("");
console.log(
  `Municipalities: ${Object.keys(MUNICIPALITIES).length}`
);
console.log(
  `Barangays:      ${barangayFeatures.length}`
);
console.log("");
console.log("Generated:");
console.log(
  "  public/geojson/aklan-barangays.geojson"
);
console.log(
  "  public/geojson/aklan-municipalities-metadata.geojson"
);
console.log("");
console.log("Aklan PSGC:");
console.log(`  ${AKLAN_PROVINCE_CODE}`);
console.log("");
console.log("======================================");