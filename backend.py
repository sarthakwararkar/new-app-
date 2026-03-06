from fastapi import FastAPI, Form, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from bs4 import BeautifulSoup
from concurrent.futures import ThreadPoolExecutor, as_completed
import requests
import json
import re
import os
import math
from difflib import SequenceMatcher

# Load .env file if present (GROQ_API_KEY lives here)
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))
except ImportError:
    pass

import groq as groq_sdk

# -------------------------------------------------------------
# Configuration
# -------------------------------------------------------------
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL   = "llama-3.3-70b-versatile"   # Best free Groq model (131K context, fast)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-IN,en;q=0.9",
}

# -------------------------------------------------------------
# FastAPI App
# -------------------------------------------------------------
app = FastAPI(title="SpecScouter Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------
# Data Models
# -------------------------------------------------------------
class VendorResult(BaseModel):
    vendor: str
    title: Optional[str] = None
    price: str
    url: str
    image_url: Optional[str] = None
    score: Optional[float] = None

class ShoppingListItem(BaseModel):
    part_name: str
    specifications: str
    reason: str
    is_safety_warning: bool = False
    quantity: Optional[int] = 1
    estimated_price: Optional[str] = None
    vendor: Optional[str] = None
    search_url: Optional[str] = None
    image_url: Optional[str] = None
    all_vendors: Optional[List[VendorResult]] = None

class ProjectAnalysisResponse(BaseModel):
    core_controller: str
    power_needs: str
    safety_checking: str
    shopping_list: List[ShoppingListItem]


# =============================================================
# GROQ LLM Helper
# =============================================================
def query_groq(prompt: str, system: str) -> str:
    """
    Send a prompt to Groq Cloud (completely free tier).
    Uses llama-3.3-70b-versatile with JSON-object response format
    to guarantee valid JSON output every time.
    """
    if not GROQ_API_KEY:
        raise HTTPException(
            status_code=503,
            detail=(
                "GROQ_API_KEY is not set. "
                "Add it to your .env file: GROQ_API_KEY=your_key_here"
            ),
        )
    client = groq_sdk.Groq(api_key=GROQ_API_KEY)
    try:
        completion = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": prompt},
            ],
            temperature=0.15,
            max_tokens=4096,
            response_format={"type": "json_object"},  # Forces valid JSON every time
        )
        return completion.choices[0].message.content or ""
    except groq_sdk.APIConnectionError:
        raise HTTPException(status_code=503, detail="Cannot connect to Groq API. Check internet connection.")
    except groq_sdk.RateLimitError:
        raise HTTPException(status_code=429, detail="Groq rate limit hit. Please wait a moment and try again.")
    except groq_sdk.AuthenticationError:
        raise HTTPException(status_code=401, detail="Invalid Groq API key. Check your .env file.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Groq API error: {str(e)}")


# =============================================================
# JSON Extraction Helper
# =============================================================
def extract_json_from_text(text: str) -> dict:
    """Robustly parse JSON from LLM output (handles markdown fences etc.)."""
    text = text.strip()
    # Strip markdown code fences if present
    block = re.search(r'```(?:json)?\s*\n?(.*?)\n?\s*```', text, re.DOTALL)
    if block:
        text = block.group(1).strip()
    # Find outermost { ... }
    depth = 0
    start_idx = None
    for i, ch in enumerate(text):
        if ch == '{':
            if depth == 0:
                start_idx = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start_idx is not None:
                text = text[start_idx : i + 1]
                break
    # Remove trailing commas (common LLM mistake)
    text = re.sub(r',\s*([\]}])', r'\1', text)
    return json.loads(text)


def repair_shopping_list(items: list) -> list:
    """Normalize shopping list item keys in case the model used variants."""
    repaired = []
    for item in items:
        clean: dict = {}
        for key, value in item.items():
            k = key.lower().replace(" ", "_")
            if "part_name" in k or k == "name" or k == "component":
                clean["part_name"] = str(value)
            elif "spec" in k:
                clean["specifications"] = str(value)
            elif "reason" in k or "why" in k:
                clean["reason"] = str(value)
            elif "safety" in k or "warning" in k:
                clean["is_safety_warning"] = bool(value)
            elif "qty" in k or "quantity" in k or "count" in k:
                try:
                    clean["quantity"] = int(value)
                except Exception:
                    clean["quantity"] = 1
            else:
                clean[key] = value
        clean.setdefault("part_name", "Unknown Component")
        clean.setdefault("specifications", "Standard")
        clean.setdefault("reason", "Required for the project")
        clean.setdefault("is_safety_warning", False)
        clean.setdefault("quantity", 1)
        repaired.append(clean)
    return repaired


# =============================================================
# Price / Text Helpers
# =============================================================
def _parse_price(price_str: str) -> float:
    cleaned = re.sub(r'[^\d.]', '', (price_str or "").replace(',', ''))
    try:
        val = float(cleaned)
        # Sanity check: ignore ₹0 or absurdly large prices
        if val <= 0 or val > 500000:
            return float('inf')
        return val
    except ValueError:
        return float('inf')


def _clean_text(s: Optional[str]) -> str:
    return re.sub(r'\s+', ' ', (s or '').strip())


_STOPWORDS = {
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has',
    'have', 'in', 'is', 'it', 'its', 'of', 'on', 'or', 'that', 'the', 'this',
    'to', 'with', 'buy', 'price', 'india', 'online', 'best', 'new', 'original',
    'pack', 'pcs', 'pc', 'set', 'kit', 'module', 'board',
}


def _normalize(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[^a-z0-9\-+\s]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def _tokenize(text: str) -> List[str]:
    return re.findall(r'[a-z0-9]+(?:-[a-z0-9]+)*', _normalize(text))


def _key_tokens(query: str) -> List[str]:
    seen: set = set()
    out: List[str] = []
    for t in _tokenize(query):
        if t in _STOPWORDS:
            continue
        if any(ch.isdigit() for ch in t) or len(t) >= 3:
            if t not in seen:
                out.append(t)
                seen.add(t)
    return out


def _token_coverage(keys: List[str], title: str) -> float:
    if not keys:
        return 0.0
    title_toks = set(_tokenize(title))
    return sum(1 for k in keys if k in title_toks) / len(keys)


def _seq_sim(a: str, b: str) -> float:
    an, bn = _normalize(a), _normalize(b)
    if not an or not bn:
        return 0.0
    return SequenceMatcher(None, an, bn).ratio()


# Lazy-load local embedding model (optional — falls back to lexical if unavailable)
_EMBEDDER = None
_EMBEDDER_ERR: Optional[str] = None


def _get_embedder():
    global _EMBEDDER, _EMBEDDER_ERR
    if _EMBEDDER is not None or _EMBEDDER_ERR is not None:
        return _EMBEDDER
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore
        _EMBEDDER = SentenceTransformer(
            os.getenv("HF_EMBED_MODEL", "BAAI/bge-small-en-v1.5")
        )
    except Exception as e:
        _EMBEDDER_ERR = str(e)
    return _EMBEDDER


def _cosine(a: List[float], b: List[float]) -> float:
    dot = na = nb = 0.0
    for x, y in zip(a, b):
        dot += x * y; na += x * x; nb += y * y
    denom = math.sqrt(na) * math.sqrt(nb)
    return (dot / denom) if denom else 0.0


def _rank_results(
    query: str,
    results: List[VendorResult],
    max_results: int,
) -> List[VendorResult]:
    """Rank candidates by relevance then break ties by price."""
    if not results:
        return []

    keys = _key_tokens(query)

    # Filter: must share at least 1 key token (2 if query has many tokens)
    min_hits = 1 if len(keys) <= 4 else 2
    filtered = []
    for r in results:
        title = r.title or ''
        cov = _token_coverage(keys, title)
        if keys and cov == 0.0:
            continue
        if keys and min_hits >= 2:
            hit_count = sum(1 for k in keys if k in set(_tokenize(title)))
            if hit_count < 2:
                continue
        # Price sanity check: skip results with no real price
        if _parse_price(r.price) == float('inf'):
            continue
        filtered.append(r)

    candidates = filtered if filtered else results

    embedder = _get_embedder()
    if embedder is not None:
        q_vec = embedder.encode([query], normalize_embeddings=False)[0]
        titles = [(c.title or '') for c in candidates]
        t_vecs = embedder.encode(titles, normalize_embeddings=False)
        for c, vec in zip(candidates, t_vecs):
            sim = _cosine(q_vec, vec)
            cov = _token_coverage(keys, c.title or '')
            c.score = float(0.88 * sim + 0.12 * cov)
    else:
        for c in candidates:
            sim = _seq_sim(query, c.title or '')
            cov = _token_coverage(keys, c.title or '')
            c.score = float(0.7 * sim + 0.3 * cov)

    # Sort: best score first, break ties by lowest price
    candidates.sort(key=lambda r: (-(r.score or 0.0), _parse_price(r.price)))
    return candidates[:max_results]


# =============================================================
# Vendor Scrapers (6 vendors)
# =============================================================
def _search_robu(query: str, max_results: int = 8) -> List[VendorResult]:
    """Robu.in"""
    try:
        url = f"https://robu.in/?s={query.replace(' ', '+')}&post_type=product"
        res = requests.get(url, headers=HEADERS, timeout=8)
        if res.status_code != 200:
            return []
        soup = BeautifulSoup(res.text, 'html.parser')
        out: List[VendorResult] = []
        for product in soup.select('.product, .product-item')[:max_results * 2]:
            price_elem = (
                product.select_one('.price .amount')
                or product.select_one('.price ins .amount')
                or product.select_one('.woocommerce-Price-amount')
            )
            link_elem  = product.select_one('a.woocommerce-LoopProduct-link') or product.select_one('a')
            title_elem = product.select_one('.woocommerce-loop-product__title') or product.select_one('h2')
            image_elem = product.select_one('.archive-product-image-inner img') or product.select_one('img')
            if price_elem and link_elem:
                out.append(VendorResult(
                    vendor="Robu.in",
                    title=_clean_text(title_elem.get_text()) if title_elem else None,
                    price=_clean_text(price_elem.get_text()),
                    url=link_elem.get('href', url),
                    image_url=(image_elem.get('src') or image_elem.get('data-src')) if image_elem else None,
                ))
            if len(out) >= max_results:
                break
        return out
    except Exception as e:
        print(f"[Robu.in] {e}")
        return []


def _search_electronicscomp(query: str, max_results: int = 8) -> List[VendorResult]:
    """ElectronicsComp.com"""
    try:
        url = (
            f"https://www.electronicscomp.com/index.php?route=product/search"
            f"&search={requests.utils.quote(query)}"
        )
        res = requests.get(url, headers=HEADERS, timeout=8)
        if res.status_code != 200:
            return []
        soup = BeautifulSoup(res.text, 'html.parser')
        out: List[VendorResult] = []
        for product in soup.select('.product-thumb, .product-layout')[:max_results * 2]:
            price_elem = (
                product.select_one('.price-new')
                or product.select_one('.price')
                or product.select_one('.price-tax')
            )
            link_elem  = (
                product.select_one('.product-img a')
                or product.select_one('.image a')
                or product.select_one('h4 a')
                or product.select_one('a')
            )
            title_elem = product.select_one('h4 a') or product.select_one('.caption a') or link_elem
            image_elem = product.select_one('img')
            if price_elem:
                price_text = _clean_text(price_elem.get_text()).split('\n')[0].replace('Ex Tax:', '').strip()
                out.append(VendorResult(
                    vendor="ElectronicsComp",
                    title=_clean_text(title_elem.get_text()) if title_elem else None,
                    price=price_text,
                    url=link_elem.get('href', url) if link_elem else url,
                    image_url=(image_elem.get('src') if image_elem else None),
                ))
            if len(out) >= max_results:
                break
        return out
    except Exception as e:
        print(f"[ElectronicsComp] {e}")
        return []


def _search_amazon(query: str, max_results: int = 8) -> List[VendorResult]:
    """Amazon.in"""
    try:
        url = f"https://www.amazon.in/s?k={requests.utils.quote(query)}"
        res = requests.get(url, headers=HEADERS, timeout=8)
        if res.status_code != 200:
            return []
        soup = BeautifulSoup(res.text, 'html.parser')
        out: List[VendorResult] = []
        for result in soup.select('[data-component-type="s-search-result"]'):
            title_elem  = result.select_one('h2 span') or result.select_one('h2')
            link_elem   = result.select_one('h2 a.a-link-normal')
            price_whole = result.select_one('.a-price-whole')
            image_elem  = result.select_one('.s-image')
            if not title_elem or not link_elem or not price_whole:
                continue
            title = _clean_text(title_elem.get_text())
            if not title:
                continue
            price_text  = _clean_text(price_whole.get_text()).rstrip('.')
            product_url = "https://www.amazon.in" + link_elem.get('href', '')
            out.append(VendorResult(
                vendor="Amazon.in",
                title=title,
                price=f"₹{price_text}",
                url=product_url,
                image_url=(image_elem.get('src') if image_elem else None),
            ))
            if len(out) >= max_results:
                break
        return out
    except Exception as e:
        print(f"[Amazon.in] {e}")
        return []


def _search_indiamart(query: str, max_results: int = 8) -> List[VendorResult]:
    """IndiaMART"""
    try:
        url = f"https://dir.indiamart.com/search.mp?ss={requests.utils.quote(query)}"
        res = requests.get(url, headers=HEADERS, timeout=8)
        if res.status_code != 200:
            return []
        soup = BeautifulSoup(res.text, 'html.parser')
        out: List[VendorResult] = []
        for product in soup.select('.prd-card, .lstng, .m-card'):
            price_elem = (
                product.select_one('.price')
                or product.select_one('.prc')
                or product.select_one('[class*="price"]')
            )
            link_elem  = product.select_one('a')
            title_elem = product.select_one('a') or product.select_one('h2') or product.select_one('h3')
            image_elem = product.select_one('img')
            if not price_elem or not link_elem:
                continue
            price_text = _clean_text(price_elem.get_text()).split('/')[0].strip()
            href = link_elem.get('href', url)
            if href and href.startswith('//'):
                href = 'https:' + href
            out.append(VendorResult(
                vendor="IndiaMART",
                title=_clean_text(title_elem.get_text()) if title_elem else None,
                price=price_text,
                url=href or url,
                image_url=(image_elem.get('src') or image_elem.get('data-src')) if image_elem else None,
            ))
            if len(out) >= max_results:
                break
        return out
    except Exception as e:
        print(f"[IndiaMART] {e}")
        return []


def _search_evelta(query: str, max_results: int = 8) -> List[VendorResult]:
    """Evelta.com — popular Indian electronics retailer"""
    try:
        url = f"https://evelta.com/search?q={requests.utils.quote(query)}"
        res = requests.get(url, headers=HEADERS, timeout=8)
        if res.status_code != 200:
            return []
        soup = BeautifulSoup(res.text, 'html.parser')
        out: List[VendorResult] = []
        # Evelta uses WooCommerce-style product grid
        for product in soup.select('.product, .product-item, [class*="product"]')[:max_results * 2]:
            price_elem = (
                product.select_one('.price ins .amount')
                or product.select_one('.price .amount')
                or product.select_one('.woocommerce-Price-amount')
                or product.select_one('[class*="price"]')
            )
            link_elem  = product.select_one('a')
            title_elem = (
                product.select_one('h2')
                or product.select_one('h3')
                or product.select_one('.woocommerce-loop-product__title')
            )
            image_elem = product.select_one('img')
            if not price_elem or not link_elem:
                continue
            href = link_elem.get('href', url)
            if href and not href.startswith('http'):
                href = 'https://evelta.com' + href
            out.append(VendorResult(
                vendor="Evelta.com",
                title=_clean_text(title_elem.get_text()) if title_elem else None,
                price=_clean_text(price_elem.get_text()),
                url=href,
                image_url=(image_elem.get('src') or image_elem.get('data-src')) if image_elem else None,
            ))
            if len(out) >= max_results:
                break
        return out
    except Exception as e:
        print(f"[Evelta.com] {e}")
        return []


def _search_probots(query: str, max_results: int = 8) -> List[VendorResult]:
    """ProBots.co.in — Indian robotics and electronics component store"""
    try:
        url = f"https://probots.co.in/index.php?route=product/search&search={requests.utils.quote(query)}"
        res = requests.get(url, headers=HEADERS, timeout=8)
        if res.status_code != 200:
            return []
        soup = BeautifulSoup(res.text, 'html.parser')
        out: List[VendorResult] = []
        for product in soup.select('.product-thumb, .product-layout')[:max_results * 2]:
            price_elem = (
                product.select_one('.price-new')
                or product.select_one('.price')
                or product.select_one('[class*="price"]')
            )
            link_elem  = product.select_one('h4 a') or product.select_one('.image a') or product.select_one('a')
            title_elem = product.select_one('h4 a') or product.select_one('.caption h4')
            image_elem = product.select_one('img')
            if not price_elem or not link_elem:
                continue
            href = link_elem.get('href', '')
            if href and not href.startswith('http'):
                href = 'https://probots.co.in/' + href.lstrip('/')
            out.append(VendorResult(
                vendor="ProBots",
                title=_clean_text(title_elem.get_text()) if title_elem else None,
                price=_clean_text(price_elem.get_text().split('\n')[0].replace('Ex Tax:', '').strip()),
                url=href or url,
                image_url=(image_elem.get('src') if image_elem else None),
            ))
            if len(out) >= max_results:
                break
        return out
    except Exception as e:
        print(f"[ProBots] {e}")
        return []


# =============================================================
# Multi-Vendor Search Aggregator
# =============================================================
def spec_scouter_search(part_name: str, max_suggestions: int = 15, max_per_vendor: int = 8) -> dict:
    """
    Search 6 Indian vendors in parallel and return ranked results.
    Best = most relevant by title match, tie-broken by lowest price.
    """
    vendor_fns = [
        (_search_robu,           part_name, max_per_vendor),
        (_search_electronicscomp, part_name, max_per_vendor),
        (_search_amazon,          part_name, max_per_vendor),
        (_search_indiamart,       part_name, max_per_vendor),
        (_search_evelta,          part_name, max_per_vendor),
        (_search_probots,         part_name, max_per_vendor),
    ]

    all_results: List[VendorResult] = []
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(fn, q, n): fn.__name__ for fn, q, n in vendor_fns}
        for future in as_completed(futures):
            try:
                results = future.result()
                if results:
                    all_results.extend(results)
            except Exception as e:
                print(f"[Vendor] Future error: {e}")

    if not all_results:
        return {
            "price": "Price not found",
            "vendor": "Manual Search Required",
            "url": f"https://www.google.com/search?q={requests.utils.quote(part_name)}+buy+india+price",
            "image_url": None,
            "all_vendors": [],
        }

    ranked = _rank_results(part_name, all_results, max_results=max_suggestions)
    if not ranked:
        ranked = sorted(all_results, key=lambda r: _parse_price(r.price))[:max_suggestions]

    best = ranked[0]
    return {
        "price":      best.price,
        "vendor":     best.vendor,
        "url":        best.url,
        "image_url":  best.image_url,
        "all_vendors": [r.model_dump() for r in ranked],
    }


# =============================================================
# BOM System Prompt (strong, specific)
# =============================================================
BOM_SYSTEM_PROMPT = """You are an electronics engineer who generates highly accurate Bill of Materials (BOM) for IoT and electronics projects.

RULES — follow every one of them:
1. Output ONLY valid JSON matching the schema below. No markdown, no explanation text.
2. Part names MUST include the full model number and key specs so a buyer can search for them online.
   GOOD: "ESP32-WROOM-32 DevKit V1", "LM2596S DC-DC Buck Converter 3A", "HC-SR04 Ultrasonic Sensor"
   BAD:  "Microcontroller", "Sensor", "Power supply"
3. Every project needs AT LEAST 10-15 components (often more). Think through: controller, power supply,
   voltage regulators, decoupling caps, sensors, actuators, display, communication modules,
   protection components, connectors, wires, resistors, and any mechanical parts.
4. Include QUANTITY for each item.
5. is_safety_warning must be true only for items involving mains AC, high voltage (>50V), or lithium cell charging.
6. specifications field: include voltage, current, rating, communication protocol, package, or any key buying spec.

JSON schema (output EXACTLY this):
{
  "core_controller": "chosen controller and why (2-3 sentences)",
  "power_needs": "full power supply chain with voltages, currents, and components needed",
  "safety_checking": "safety notes or 'No high voltage or safety risks identified'",
  "shopping_list": [
    {
      "part_name": "Full model name with key spec",
      "specifications": "key buying specifications",
      "reason": "why this specific part is needed",
      "is_safety_warning": false,
      "quantity": 1
    }
  ]
}"""


# =============================================================
# Endpoint: /analyze-project
# =============================================================
@app.post("/analyze-project", response_model=ProjectAnalysisResponse)
async def analyze_project(
    text_description: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
):
    """
    Analyze a project description and return a detailed BOM with live prices
    from 6 Indian electronics vendors. Powered by Groq's free llama-3.3-70b.
    """
    if not text_description and not image:
        raise HTTPException(status_code=400, detail="Provide either text_description or image.")

    user_input = text_description or ""
    if image:
        user_input += (
            "\n[Note: An image/schematic was uploaded. "
            "Analyze based on the text description and any visible components in the image description above.]"
        )

    user_prompt = f"""Project to analyze:
{user_input}

Generate a complete, accurate Bill of Materials. Remember: at least 10-15 line items, specific model numbers, real specs."""

    # Groq enforces JSON via response_format="json_object" — no retry loops needed!
    raw = query_groq(prompt=user_prompt, system=BOM_SYSTEM_PROMPT)
    print(f"[Groq] Raw response (first 400 chars):\n{raw[:400]}")

    try:
        analysis_dict = extract_json_from_text(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"AI returned malformed JSON even with JSON mode enabled: {e}\nRaw: {raw[:300]}"
        )

    # Normalize keys
    analysis_dict.setdefault("core_controller", "Not determined")
    analysis_dict.setdefault("power_needs", "Not determined")
    analysis_dict.setdefault("safety_checking", "No safety concerns identified")
    analysis_dict.setdefault("shopping_list", [])

    # Coerce top-level string fields
    for key in ["core_controller", "power_needs", "safety_checking"]:
        val = analysis_dict[key]
        if isinstance(val, bool):
            analysis_dict[key] = "Safety warning flagged" if val else "No safety concerns"
        elif not isinstance(val, str):
            analysis_dict[key] = str(val)

    # Repair shopping list
    if "shopping_list" in analysis_dict:
        analysis_dict["shopping_list"] = repair_shopping_list(analysis_dict["shopping_list"])

    # Enrich each item with live vendor prices (parallel scrape)
    def _enrich(item: dict) -> dict:
        part_name = item.get("part_name", "")
        if part_name:
            data = spec_scouter_search(part_name)
            item["estimated_price"] = data["price"]
            item["vendor"]          = data["vendor"]
            item["search_url"]      = data["url"]
            item["image_url"]       = data.get("image_url")
            item["all_vendors"]     = data.get("all_vendors", [])
        return item

    with ThreadPoolExecutor(max_workers=8) as pool:
        analysis_dict["shopping_list"] = list(
            pool.map(_enrich, analysis_dict["shopping_list"])
        )

    return analysis_dict


# =============================================================
# Health Check
# =============================================================
@app.get("/health")
async def health_check():
    """Verify Groq connectivity and API key."""
    if not GROQ_API_KEY:
        return {"status": "error", "detail": "GROQ_API_KEY not set in environment"}
    try:
        client = groq_sdk.Groq(api_key=GROQ_API_KEY)
        models = client.models.list()
        available = [m.id for m in models.data if "llama" in m.id.lower() or "mixtral" in m.id.lower()]
        return {
            "status":        "ok",
            "active_model":  GROQ_MODEL,
            "groq_models":   available[:10],
            "api_cost":      "FREE",
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}
