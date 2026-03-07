const VALID_PRODUCE = Object.freeze([
  "beans",
  "maize",
  "grain maize",
  "cow peas",
  "g-nuts",
  "soybeans"
]);

const ALIASES = Object.freeze({
  beans: "beans",
  maize: "maize",
  "grain maize": "grain maize",
  "grain-maize": "grain maize",
  "maize grain": "grain maize",
  "cow peas": "cow peas",
  cowpeas: "cow peas",
  "cow-peas": "cow peas",
  "g nuts": "g-nuts",
  "g-nuts": "g-nuts",
  gnuts: "g-nuts",
  "ground nuts": "g-nuts",
  groundnuts: "g-nuts",
  soybeans: "soybeans",
  soybean: "soybeans",
  soyabeans: "soybeans",
  soyabean: "soybeans",
  "soy bean": "soybeans",
  "soy beans": "soybeans",
  "soya beans": "soybeans",
  "soya bean": "soybeans",
  soya: "soybeans"
});

function normalizeProduceName(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return "";
  return ALIASES[normalized] || "";
}

function isValidProduceName(value) {
  return VALID_PRODUCE.includes(String(value || "").toLowerCase());
}

module.exports = {
  VALID_PRODUCE,
  normalizeProduceName,
  isValidProduceName
};
