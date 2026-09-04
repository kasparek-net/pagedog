import * as cheerio from "cheerio";

// Shops publish price and availability as schema.org Product JSON-LD. Reading
// that beats a CSS selector: it survives redesigns, it is the same on the
// desktop and mobile layout, and it is there even when the visible markup is
// built by JavaScript we never run.
export type ProductData = {
  price: string | null;
  availability: string | null;
};

export const PRODUCT_FIELDS = ["@price", "@availability"] as const;
export type ProductField = (typeof PRODUCT_FIELDS)[number];

export function isProductField(selector: string): selector is ProductField {
  return (PRODUCT_FIELDS as readonly string[]).includes(selector);
}

const AVAILABILITY_LABELS: Record<string, string> = {
  instock: "In stock",
  instoreonly: "In store only",
  onlineonly: "Online only",
  outofstock: "Out of stock",
  soldout: "Sold out",
  presale: "Pre-sale",
  preorder: "Pre-order",
  backorder: "Back-order",
  discontinued: "Discontinued",
  limitedavailability: "Limited availability",
};

export function productFromHtml(html: string): ProductData {
  const $ = cheerio.load(html);
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    const node = findProduct(parseJson($(el).text()));
    if (!node) continue;
    const offer = firstOffer(node);
    if (!offer) continue;
    return {
      price: formatPrice(offer.price, offer.priceCurrency),
      availability: formatAvailability(offer.availability),
    };
  }
  return { price: null, availability: null };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

type Json = Record<string, unknown>;

function findProduct(node: unknown, depth = 0): Json | null {
  if (!node || depth > 4) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findProduct(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== "object") return null;
  const obj = node as Json;
  const type = obj["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((t) => typeof t === "string" && t.toLowerCase() === "product")) return obj;
  return findProduct(obj["@graph"], depth + 1);
}

type Offer = { price?: unknown; priceCurrency?: unknown; availability?: unknown };

function firstOffer(product: Json): Offer | null {
  const offers = product.offers;
  const list = Array.isArray(offers) ? offers : [offers];
  for (const o of list) {
    if (o && typeof o === "object") return o as Offer;
  }
  return null;
}

function formatPrice(price: unknown, currency: unknown): string | null {
  const n =
    typeof price === "number"
      ? price
      : typeof price === "string"
        ? parseFloat(price.replace(",", "."))
        : NaN;
  if (!Number.isFinite(n)) return null;
  const code = typeof currency === "string" ? currency : "";
  try {
    if (code) {
      return new Intl.NumberFormat("cs-CZ", {
        style: "currency",
        currency: code,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(n);
    }
  } catch {}
  return new Intl.NumberFormat("cs-CZ").format(n);
}

function formatAvailability(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const key = value.split("/").pop()?.replace(/^http.*:/, "").toLowerCase() ?? "";
  return AVAILABILITY_LABELS[key] ?? value.split("/").pop() ?? value;
}
