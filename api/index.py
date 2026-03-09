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

# Load .env file if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import groq as groq_sdk

# -------------------------------------------------------------
# Configuration
# -------------------------------------------------------------
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL   = "llama-3.3-70b-versatile"

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
    if not GROQ_API_KEY:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY is not set.")
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
            response_format={"type": "json_object"},
        )
        return completion.choices[0].message.content or ""
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Groq API error: {str(e)}")

# =============================================================
# JSON Extraction Helper
# =============================================================
def extract_json_from_text(text: str) -> dict:
    text = text.strip()
    block = re.search(r'```(?:json)?\s*\n?(.*?)\n?\s*```', text, re.DOTALL)
    if block:
        text = block.group(1).strip()
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
    text = re.sub(r',\s*([\]}])', r'\1', text)
    return json.loads(text)

def repair_shopping_list(items: list) -> list:
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

# Lexical ranking (removing embedding for serverless cold start efficiency)
def _rank_results(
    query: str,
    results: List[VendorResult],
    max_results: int,
) -> List[VendorResult]:
    if not results:
        return []
    keys = _key_tokens(query)
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
        if _parse_price(r.price) == float('inf'):
            continue
        filtered.append(r)
    candidates = filtered if filtered else results
    for c in candidates:
        sim = _seq_sim(query, c.title or '')
        cov = _token_coverage(keys, c.title or '')
        c.score = float(0.7 * sim + 0.3 * cov)
    candidates.sort(key=lambda r: (-(r.score or 0.0), _parse_price(r.price)))
    return candidates[:max_results]

# =============================================================
# Vendor Scrapers
# =============================================================
def _search_robu(query: str, max_results: int = 8) -> List[VendorResult]:
    try:
        url = f"https://robu.in/?s={query.replace(' ', '+')}&post_type=product"
        res = requests.get(url, headers=HEADERS, timeout=8)
        if res.status_code != 200: return []
        soup = BeautifulSoup(res.text, 'html.parser')
        out = []
        for product in soup.select('.product, .product-item')[:max_results * 2]:
            price_elem = product.select_one('.price .amount') or product.select_one('.woocommerce-Price-amount')
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
            if len(out) >= max_results: break
        return out
    except: return []

def _search_electronicscomp(query: str, max_results: int = 8) -> List[VendorResult]:
    try:
        url = f"https://www.electronicscomp.com/index.php?route=product/search&search={requests.utils.quote(query)}"
        res = requests.get(url, headers=HEADERS, timeout=8)
        if res.status_code != 200: return []
        soup = BeautifulSoup(res.text, 'html.parser')
        out = []
        for product in soup.select('.product-thumb, .product-layout')[:max_results * 2]:
            price_elem = product.select_one('.price-new') or product.select_one('.price')
            link_elem  = product.select_one('.product-img a') or product.select_one('.image a')
            title_elem = product.select_one('h4 a') or product.select_one('.caption a')
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
            if len(out) >= max_results: break
        return out
    except: return []

def _search_amazon(query: str, max_results: int = 8) -> List[VendorResult]:
    try:
        url = f"https://www.amazon.in/s?k={requests.utils.quote(query)}"
        res = requests.get(url, headers=HEADERS, timeout=8)
        if res.status_code != 200: return []
        soup = BeautifulSoup(res.text, 'html.parser')
        out = []
        for result in soup.select('[data-component-type="s-search-result"]'):
            title_elem = result.select_one('h2 span')
            link_elem = result.select_one('h2 a.a-link-normal')
            price_whole = result.select_one('.a-price-whole')
            image_elem = result.select_one('.s-image')
            if title_elem and link_elem and price_whole:
                out.append(VendorResult(
                    vendor="Amazon.in",
                    title=_clean_text(title_elem.get_text()),
                    price=f"₹{_clean_text(price_whole.get_text()).rstrip('.')}",
                    url="https://www.amazon.in" + link_elem.get('href', ''),
                    image_url=image_elem.get('src') if image_elem else None,
                ))
            if len(out) >= max_results: break
        return out
    except: return []

# Skipping heavy functions for now to keep index.py clean, or including simplified versions
def spec_scouter_search(part_name: str, max_suggestions: int = 15, max_per_vendor: int = 8) -> dict:
    vendor_fns = [
        (_search_robu, part_name, max_per_vendor),
        (_search_electronicscomp, part_name, max_per_vendor),
        (_search_amazon, part_name, max_per_vendor),
    ]
    all_results = []
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {executor.submit(fn, q, n): fn.__name__ for fn, q, n in vendor_fns}
        for future in as_completed(futures):
            try:
                results = future.result()
                if results: all_results.extend(results)
            except: pass
    if not all_results:
        return {"price": "Price not found", "vendor": "Manual Search Required", "url": f"https://www.google.com/search?q={requests.utils.quote(part_name)}"}
    ranked = _rank_results(part_name, all_results, max_results=max_suggestions)
    best = ranked[0]
    return {
        "price": best.price, "vendor": best.vendor, "url": best.url, "image_url": best.image_url,
        "all_vendors": [r.model_dump() for r in ranked],
    }

BOM_SYSTEM_PROMPT = """You are an electronics engineer generating BOMs in JSON.
Schema: {core_controller, power_needs, safety_checking, shopping_list: [{part_name, specifications, reason, is_safety_warning, quantity}]}"""

@app.post("/api/analyze-project", response_model=ProjectAnalysisResponse)
@app.post("/analyze-project", response_model=ProjectAnalysisResponse)
async def analyze_project(
    text_description: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
):
    if not text_description and not image:
        raise HTTPException(status_code=400, detail="Provide input.")
    user_input = text_description or ""
    user_prompt = f"Analyze: {user_input}"
    raw = query_groq(prompt=user_prompt, system=BOM_SYSTEM_PROMPT)
    analysis_dict = extract_json_from_text(raw)
    analysis_dict.setdefault("shopping_list", [])
    analysis_dict["shopping_list"] = repair_shopping_list(analysis_dict["shopping_list"])
    
    def _enrich(item: dict) -> dict:
        part_name = item.get("part_name", "")
        if part_name:
            data = spec_scouter_search(part_name)
            item.update({"estimated_price": data["price"], "vendor": data["vendor"], "search_url": data["url"], "image_url": data.get("image_url"), "all_vendors": data.get("all_vendors", [])})
        return item

    with ThreadPoolExecutor(max_workers=5) as pool:
        analysis_dict["shopping_list"] = list(pool.map(_enrich, analysis_dict["shopping_list"]))
    return analysis_dict

@app.get("/api/health")
@app.get("/health")
async def health():
    return {"status": "ok", "environment": os.environ.get("VERCEL_ENV", "local")}

@app.get("/")
async def root():
    return {
        "message": "FastAPI is running, but this request should probably be handled by Next.js. Check your Vercel Framework settings.",
        "path": "/",
        "env": os.environ.get("VERCEL_ENV", "unknown")
    }
