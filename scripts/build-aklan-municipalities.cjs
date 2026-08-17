const fs = require("fs");
const path = require("path");

const {
  featureCollection,
  polygon,
  multiPolygon,
} = require("@turf/helpers");

const { union } = require("@turf/union");

const OUTPUT_DIR = path.join(
  process.cwd(),
  "public",
  "geojson"
);

const OUTPUT_FILE = path.join(
  OUTPUT_DIR,
  "aklan-municipalities.geojson"
);

const BARANGAY_FILE = path.join(
  OUTPUT_DIR,
  "aklan-barangays.geojson"
);

// Official Aklan municipality PSGC codes
const AKLAN_MUNICIPALITIES = [
  ["600401000", "Altavas"],
  ["600402000", "Balete"],
  ["600403000", "Banga"],
  ["600404000", "Batan"],
  ["600405000", "Buruanga"],
  ["600406000", "Ibajay"],
  ["600407000", "Kalibo"],
  ["600408000", "Lezo"],
  ["600409000", "Libacao"],
  ["600410000", "Madalag"],
  ["600411000", "Makato"],
  ["600412000", "Malay"],
  ["600413000", "Malinao"],
  ["600414000", "Nabas"],
  ["600415000", "New Washington"],
  ["600416000", "Numancia"],
  ["600417000", "Tangalan"],
];

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function polygonParts(feature) {
  const geometry = feature.geometry;

  if (!geometry) {
    return [];
  }

  // Normal Polygon
  if (geometry.type === "Polygon") {
    return [
      polygon(
        clone(geometry.coordinates),
        clone(feature.properties || {})
      ),
    ];
  }

  // MultiPolygon -> split into individual Polygon features
  if (geometry.type === "MultiPolygon") {
    return geometry.coordinates.map((coordinates) =>
      polygon(
        clone(coordinates),
        clone(feature.properties || {})
      )
    );
  }

  return [];
}

function normalizeUnionResult(result, properties) {
  if (!result) {
    return null;
  }

  return {
    type: "Feature",
    properties,
    geometry: clone(result.geometry),
  };
}

async function unionAll(features) {
  if (features.length === 0) {
    return null;
  }

  if (features.length === 1) {
    return clone(features[0]);
  }

  let current = features[0];

  for (let i = 1; i < features.length; i++) {
    const next = features[i];

    try {
      const result = union(
        featureCollection([
          current,
          next,
        ])
      );

      if (result) {
        current = result;
      }
    } catch (error) {
      console.warn(
        `Warning: union failed at feature ${i + 1}/${features.length}`
      );

      console.warn(error.message);
    }

    // Show progress every 10 features
    if ((i + 1) % 10 === 0 || i === features.length - 1) {
      process.stdout.write(
        `\r    Union progress: ${i + 1}/${features.length}`
      );
    }
  }

  console.log("");

  return current;
}

async function main() {
  console.log("");
  console.log("==========================================");
  console.log(" FloodGuard-Aklan Municipality Builder");
  console.log("==========================================");
  console.log("");

  if (!fs.existsSync(BARANGAY_FILE)) {
    throw new Error(
      `Barangay GeoJSON not found:\n${BARANGAY_FILE}`
    );
  }

  const raw = fs.readFileSync(
    BARANGAY_FILE,
    "utf8"
  );

  if (!raw.trim()) {
    throw new Error(
      "aklan-barangays.geojson is empty."
    );
  }

  const barangayData = JSON.parse(raw);

  if (
    barangayData.type !== "FeatureCollection" ||
    !Array.isArray(barangayData.features)
  ) {
    throw new Error(
      "Invalid barangay GeoJSON."
    );
  }

  console.log(
    `Total barangays loaded: ${barangayData.features.length}`
  );

  // Make sure only actual Aklan barangays are used.
  const aklanBarangays =
    barangayData.features.filter((feature) => {
      const p = feature.properties || {};

      const province = String(
        p.province ||
        p.Province ||
        p.adm1_en ||
        ""
      ).trim();

      const adm2 = String(
        p.adm2_psgc || ""
      );

      return (
        province.toUpperCase() === "AKLAN" ||
        adm2 === "600400000"
      );
    });

  console.log(
    `Aklan barangays: ${aklanBarangays.length}`
  );

  if (aklanBarangays.length === 0) {
    throw new Error(
      "No Aklan barangays found."
    );
  }

  const municipalityFeatures = [];

  for (
    const [municipalityCode, municipalityName]
    of AKLAN_MUNICIPALITIES
  ) {
    console.log("");
    console.log(
      `Processing ${municipalityName} (${municipalityCode})...`
    );

    // Find barangays belonging to this municipality
    const municipalityBarangays =
      aklanBarangays.filter((feature) => {
        const p = feature.properties || {};

        const adm3 = String(
          p.adm3_psgc ||
          p.municipality_psgc ||
          ""
        );

        return adm3 === municipalityCode;
      });

    console.log(
      `  Barangays: ${municipalityBarangays.length}`
    );

    if (municipalityBarangays.length === 0) {
      console.warn(
        `  WARNING: No barangays found for ${municipalityName}`
      );

      continue;
    }

    // Convert every Polygon/MultiPolygon
    // into individual Polygon features.
    const polygonFeatures = [];

    for (
      const barangay
      of municipalityBarangays
    ) {
      const parts =
        polygonParts(barangay);

      polygonFeatures.push(...parts);
    }

    console.log(
      `  Polygon parts: ${polygonFeatures.length}`
    );

    if (polygonFeatures.length === 0) {
      console.warn(
        `  WARNING: No polygon geometry found for ${municipalityName}`
      );

      continue;
    }

    // Union all barangay polygons
    const dissolved =
      await unionAll(polygonFeatures);

    if (!dissolved) {
      console.warn(
        `  WARNING: Could not create boundary for ${municipalityName}`
      );

      continue;
    }

    const municipalityFeature = {
      type: "Feature",
      properties: {
        adm1_psgc: "600000000",
        adm2_psgc: "600400000",
        adm3_psgc: municipalityCode,
        municipality_psgc: municipalityCode,
        municipality: municipalityName,
        province: "Aklan",
        geo_level: "Mun",
      },
      geometry: dissolved.geometry,
    };

    municipalityFeatures.push(
      municipalityFeature
    );

    console.log(
      `  ✓ ${municipalityName} completed`
    );

    console.log(
      `  Geometry: ${dissolved.geometry.type}`
    );
  }

  if (municipalityFeatures.length === 0) {
    throw new Error(
      "No municipality boundaries were generated."
    );
  }

  const output = {
    type: "FeatureCollection",
    name: "Aklan Municipalities",
    features: municipalityFeatures,
  };

  fs.mkdirSync(
    OUTPUT_DIR,
    {
      recursive: true,
    }
  );

  fs.writeFileSync(
    OUTPUT_FILE,
    JSON.stringify(output)
  );

  console.log("");
  console.log("==========================================");
  console.log(" BUILD SUCCESSFUL");
  console.log("==========================================");
  console.log(
    `Municipalities: ${output.features.length}`
  );
  console.log(
    `Output: ${OUTPUT_FILE}`
  );
  console.log("");

  const geometryTypes = [
    ...new Set(
      output.features.map(
        (f) => f.geometry?.type
      )
    ),
  ];

  console.log(
    "Geometry types:",
    geometryTypes.join(", ")
  );

  console.log("");
  console.log("Municipalities generated:");

  for (
    const feature
    of output.features
  ) {
    console.log(
      `  ${feature.properties.adm3_psgc} | ${feature.properties.municipality} | ${feature.geometry.type}`
    );
  }

  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error("==========================================");
  console.error(" BUILD FAILED");
  console.error("==========================================");
  console.error(error);
  process.exit(1);
});