import json
import logging
import re
import time
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Dict, List, Optional
import requests

logger = logging.getLogger("sreda.data_hub")

# Default Base APIs Catalog
DEFAULT_FEEDS_CONFIG = {
    "apis": {
        "crypto": {"name": "Криптовалюта (CoinCap / CoinGecko)", "enabled": True, "category": "finance"},
        "stocks": {"name": "Акции, Индексы, Металлы (Yahoo Finance)", "enabled": True, "category": "finance"},
        "rates": {"name": "Курсы мировых валют (ExchangeRate-API)", "enabled": True, "category": "finance"},
        "weather": {"name": "Погода и Прогнозы (Open-Meteo)", "enabled": True, "category": "geo"},
        "geocoding": {"name": "Геокодинг и Население (Open-Meteo Geo)", "enabled": True, "category": "geo"},
        "countries": {"name": "Страны и Столицы (REST Countries)", "enabled": True, "category": "geo"},
        "avatars": {"name": "Генератор аватаров (Dicebear API)", "enabled": True, "category": "profile"},
    },
    "news": {
        "hackernews": {"name": "Hacker News (Y Combinator Official)", "enabled": True, "category": "tech"},
        "gdelt": {"name": "GDELT Project (Мировой медиа-мониторинг)", "enabled": True, "category": "world"},
    },
    "custom_rss": [
        {
            "id": "rss_habr",
            "name": "Хабр: Лучшие публикации",
            "url": "https://habr.com/ru/rss/best/daily/?fl=ru",
            "category": "tech",
            "enabled": True
        },
        {
            "id": "rss_rbc",
            "name": "РБК: Главные новости",
            "url": "https://rssexport.rbc.ru/rbcnews/news/30/full.rss",
            "category": "news",
            "enabled": True
        },
        {
            "id": "rss_techcrunch",
            "name": "TechCrunch: Latest News",
            "url": "https://techcrunch.com/feed/",
            "category": "tech",
            "enabled": True
        }
    ],
    "custom_apis": [
        {
            "id": "api_weatherapi",
            "name": "WeatherAPI (Пример)",
            "category": "weather",
            "url": "https://api.weatherapi.com/v1/current.json?q={query}&key={key}",
            "method": "GET",
            "key": "",
            "auth_type": "param",
            "auth_header": "X-Api-Key",
            "description": "Почасовой прогноз погоды и осадки по городу",
            "enabled": False
        }
    ]
}

class DataHubService:
    def __init__(self, base_dir: Path):
        self.base_dir = Path(base_dir)
        self.config_dir = self.base_dir / "backend" / "config"
        self.config_dir.mkdir(parents=True, exist_ok=True)
        self.config_file = self.config_dir / "feeds.json"
        self.config = self._load_config()

        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SREDA-AI/7.0"
        })

    def _load_config(self) -> Dict[str, Any]:
        """Load feeds configuration from JSON or initialize with defaults."""
        if self.config_file.exists():
            try:
                with open(self.config_file, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    for k in ["apis", "news", "custom_rss", "custom_apis"]:
                        if k not in cfg:
                            cfg[k] = DEFAULT_FEEDS_CONFIG[k]
                    return cfg
            except Exception as e:
                logger.warning(f"Failed to load feeds.json: {e}")
        return DEFAULT_FEEDS_CONFIG.copy()

    def save_config(self, cfg: Dict[str, Any]) -> bool:
        """Persist feeds configuration."""
        try:
            self.config = cfg
            with open(self.config_file, "w", encoding="utf-8") as f:
                json.dump(cfg, f, ensure_ascii=False, indent=2)
            return True
        except Exception as e:
            logger.error(f"Failed to save feeds.json: {e}")
            return False

    # --- 1. CRYPTO (CoinGecko Primary, CoinCap Fallback) ---
    def fetch_crypto(self, query: str = "bitcoin") -> Dict[str, Any]:
        """Fetch real-time cryptocurrency quote and 24h dynamics."""
        q_clean = query.lower().strip()
        ALIAS_MAP = {
            "btc": "bitcoin", "биткоин": "bitcoin", "биток": "bitcoin",
            "eth": "ethereum", "эфир": "ethereum", "эфириум": "ethereum",
            "sol": "solana", "солана": "solana",
            "ton": "the-open-network", "тон": "the-open-network",
            "usdt": "tether", "тезер": "tether",
            "bnb": "binance-coin", "xrp": "ripple", "doge": "dogecoin", "доги": "dogecoin",
            "ada": "cardano", "кардано": "cardano"
        }
        asset_id = ALIAS_MAP.get(q_clean, q_clean)

        # 1. Primary: CoinGecko Public API (High-speed, 100% keyless)
        try:
            url = f"https://api.coingecko.com/api/v3/simple/price?ids={asset_id}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true"
            resp = self.session.get(url, timeout=3.5)
            if resp.status_code == 200:
                data = resp.json().get(asset_id, {})
                if data and "usd" in data:
                    price = float(data.get("usd", 0))
                    change = float(data.get("usd_24h_change", 0))
                    mcap = round(float(data.get("usd_market_cap", 0)) / 1e9, 2)
                    vol = round(float(data.get("usd_24h_vol", 0)) / 1e6, 2)
                    name_disp = asset_id.capitalize()
                    return {
                        "success": True,
                        "service": "CoinGecko",
                        "symbol": asset_id.upper()[:4],
                        "name": name_disp,
                        "price_usd": round(price, 2) if price >= 1 else round(price, 6),
                        "change_24h_percent": round(change, 2),
                        "market_cap_usd": mcap,
                        "volume_24h_usd": vol,
                        "text_summary": f"Курс {name_disp}: ${price:,.2f} USD (24ч: {change:+.2f}%, кап: ${mcap} млрд)."
                    }
        except Exception:
            pass

        # 2. Fallback: CoinCap API
        try:
            url = f"https://api.coincap.io/v2/assets/{asset_id}"
            resp = self.session.get(url, timeout=2.0)
            if resp.status_code == 200:
                d = resp.json().get("data", {})
                price = float(d.get("priceUsd", 0))
                change_24h = float(d.get("changePercent24Hr", 0))
                return {
                    "success": True,
                    "service": "CoinCap",
                    "symbol": d.get("symbol"),
                    "name": d.get("name"),
                    "price_usd": round(price, 2) if price >= 1 else round(price, 6),
                    "change_24h_percent": round(change_24h, 2),
                    "market_cap_usd": round(float(d.get("marketCapUsd", 0)) / 1e9, 2),
                    "volume_24h_usd": round(float(d.get("volumeUsd24Hr", 0)) / 1e6, 2),
                    "text_summary": f"Курс {d.get('name')} ({d.get('symbol')}): ${price:,.2f} USD (24ч: {change_24h:+.2f}%)."
                }
        except Exception:
            pass

        return {"success": False, "error": f"Криптовалюта '{query}' не найдена"}

    # --- 2. STOCKS, COMMODITIES, INDEXES (Yahoo Finance) ---
    def fetch_stocks(self, symbol: str = "AAPL") -> Dict[str, Any]:
        """Fetch stock, metal, or index quote from Yahoo Finance."""
        sym = symbol.upper().strip()
        ALIAS = {
            "ЗОЛОТО": "GC=F", "GOLD": "GC=F",
            "СЕРЕБРО": "SI=F", "SILVER": "SI=F",
            "НЕФТЬ": "CL=F", "BRENT": "BZ=F", "OIL": "CL=F",
            "SP500": "^GSPC", "S&P500": "^GSPC", "NASDAQ": "^IXIC",
            "ТЕХ": "^IXIC", "МОСБИРЖА": "IMOEX.ME"
        }
        target_ticker = ALIAS.get(sym, sym)

        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{target_ticker}?interval=1d&range=2d"
            resp = self.session.get(url, timeout=5)
            if resp.status_code == 200:
                result = resp.json().get("chart", {}).get("result", [])
                if not result:
                    return {"success": False, "error": f"Тикер '{symbol}' не найден на бирже"}

                meta = result[0].get("meta", {})
                price = meta.get("regularMarketPrice", 0)
                prev_close = meta.get("chartPreviousClose", price)
                change_pct = ((price - prev_close) / prev_close * 100) if prev_close else 0.0

                currency = meta.get("currency", "USD")
                name = meta.get("shortName") or meta.get("symbol", target_ticker)

                return {
                    "success": True,
                    "service": "Yahoo Finance",
                    "symbol": target_ticker,
                    "name": name,
                    "price": round(price, 2),
                    "currency": currency,
                    "change_percent": round(change_pct, 2),
                    "text_summary": f"Котировка {name} [{target_ticker}]: {price:,.2f} {currency} ({change_pct:+.2f}%)."
                }
        except Exception as e:
            return {"success": False, "error": f"Ошибка Yahoo Finance: {e}"}

        return {"success": False, "error": f"Не удалось загрузить данные по акции/тикеру '{symbol}'"}

    # --- 3. FIAT EXCHANGE RATES (ExchangeRate-API) ---
    def fetch_rates(self, base_currency: str = "USD") -> Dict[str, Any]:
        """Fetch fiat currency exchange rates."""
        base = base_currency.upper().strip()
        try:
            url = f"https://open.er-api.com/v6/latest/{base}"
            resp = self.session.get(url, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                rates = data.get("rates", {})
                popular = ["RUB", "USD", "EUR", "CNY", "GBP", "KZT", "TRY", "AED", "CHF", "JPY"]
                filtered = {cur: rates.get(cur) for cur in popular if cur in rates and cur != base}

                rub_rate = rates.get("RUB", 0)
                summary_lines = [f"Курс валют относительно {base}:"]
                if "RUB" in rates and base != "RUB":
                    summary_lines.append(f"• 1 {base} = {rub_rate:.2f} руб.")
                for cur, r in filtered.items():
                    if cur != "RUB":
                        summary_lines.append(f"• 1 {base} = {r:.2f} {cur}")

                return {
                    "success": True,
                    "service": "ExchangeRate-API",
                    "base": base,
                    "date": data.get("time_last_update_utc", ""),
                    "rates": filtered,
                    "text_summary": "\n".join(summary_lines)
                }
        except Exception as e:
            return {"success": False, "error": f"Ошибка курсов валют: {e}"}

        return {"success": False, "error": f"Не удалось обновить курсы для валюты '{base}'"}

    # --- 4. WEATHER & GEOCODING (Open-Meteo) ---
    def fetch_weather(self, location: str = "Москва") -> Dict[str, Any]:
        """Fetch accurate weather forecast without API keys via Open-Meteo."""
        try:
            # 1. Geocoding
            geo_url = f"https://geocoding-api.open-meteo.com/v1/search?name={location}&count=1&language=ru&format=json"
            geo_resp = self.session.get(geo_url, timeout=5)
            if geo_resp.status_code != 200 or not geo_resp.json().get("results"):
                return {"success": False, "error": f"Город '{location}' не найден в геокодере"}

            geo = geo_resp.json()["results"][0]
            lat = geo["latitude"]
            lon = geo["longitude"]
            city_name = geo.get("name", location)
            country = geo.get("country", "")

            # 2. Weather forecast
            weather_url = (
                f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
                f"&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m"
                f"&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto"
            )
            w_resp = self.session.get(weather_url, timeout=5)
            if w_resp.status_code == 200:
                cur = w_resp.json().get("current", {})
                daily = w_resp.json().get("daily", {})

                WMO_MAP = {
                    0: "Ясно ☀️", 1: "Преимущественно ясно 🌤", 2: "Переменная облачность ⛅", 3: "Пасмурно ☁️",
                    45: "Туман 🌫", 51: "Легкая морось 🌧", 61: "Небольшой дождь 🌦", 63: "Умеренный дождь 🌧",
                    65: "Сильный ливень ⛈", 71: "Снегопад ❄️", 95: "Гроза ⚡"
                }
                desc = WMO_MAP.get(cur.get("weather_code", 0), "Облачно")

                temp = cur.get("temperature_2m", 0)
                feels = cur.get("apparent_temperature", temp)
                wind = cur.get("wind_speed_10m", 0)
                humidity = cur.get("relative_humidity_2m", 0)

                summary = (
                    f"Погода в г. {city_name} ({country}):\n"
                    f"• Состояние: {desc}\n"
                    f"• Температура: {temp:+0.1f}°C (ощущается как {feels:+0.1f}°C)\n"
                    f"• Ветер: {wind} км/ч, влажность: {humidity}%\n"
                    f"• Прогноз на сегодня: от {daily.get('temperature_2m_min', [temp])[0]:+0.1f}°C до {daily.get('temperature_2m_max', [temp])[0]:+0.1f}°C"
                )

                return {
                    "success": True,
                    "service": "Open-Meteo",
                    "city": city_name,
                    "country": country,
                    "latitude": lat,
                    "longitude": lon,
                    "temperature_c": temp,
                    "feels_like_c": feels,
                    "weather_desc": desc,
                    "wind_speed_kmh": wind,
                    "humidity_percent": humidity,
                    "text_summary": summary
                }
        except Exception as e:
            return {"success": False, "error": f"Ошибка Open-Meteo: {e}"}

        return {"success": False, "error": "Не удалось получить прогноз погоды"}

    # --- 5. COUNTRIES & GEOGRAPHY (Open-Meteo Geo API) ---
    def fetch_country(self, country_name: str) -> Dict[str, Any]:
        """Fetch comprehensive data on a country or territory with native multilingual support."""
        c_clean = country_name.strip()
        try:
            url = f"https://geocoding-api.open-meteo.com/v1/search?name={c_clean}&count=1&language=ru&format=json"
            resp = self.session.get(url, timeout=5)
            if resp.status_code == 200 and resp.json().get("results"):
                res = resp.json()["results"][0]
                name = res.get("name", country_name)
                country = res.get("country", name)
                cc = res.get("country_code", "").upper()
                pop = res.get("population", 0)
                lat = res.get("latitude", 0)
                lon = res.get("longitude", 0)
                tz = res.get("timezone", "")
                elev = res.get("elevation", 0)

                # Derive country flag emoji from ISO 3166-1 alpha-2
                flag = "🌍"
                if len(cc) == 2 and cc.isalpha():
                    flag = chr(127397 + ord(cc[0])) + chr(127397 + ord(cc[1]))

                summary = (
                    f"География: {flag} {name} ({country}):\n"
                    f"• Код страны: {cc}\n"
                    f"• Население: {pop:,.0f} чел.\n"
                    f"• Координаты: {lat:.3f}°, {lon:.3f}° (высота: {elev} м)\n"
                    f"• Часовой пояс: {tz}"
                )

                return {
                    "success": True,
                    "service": "Open-Meteo Geo",
                    "country": name,
                    "full_country": country,
                    "country_code": cc,
                    "flag_emoji": flag,
                    "population": pop,
                    "latitude": lat,
                    "longitude": lon,
                    "timezone": tz,
                    "elevation": elev,
                    "text_summary": summary
                }
        except Exception as e:
            return {"success": False, "error": f"Ошибка гео-справочника: {e}"}

        return {"success": False, "error": f"Страна или регион '{country_name}' не найден"}

    # --- 6. HACKER NEWS (Official Firebase API) ---
    def fetch_hacker_news(self, limit: int = 5) -> Dict[str, Any]:
        """Fetch top trending developer news from Hacker News without credentials."""
        try:
            top_ids_url = "https://hacker-news.firebaseio.com/v0/topstories.json"
            resp = self.session.get(top_ids_url, timeout=5)
            if resp.status_code != 200:
                return {"success": False, "error": "Hacker News API недоступен"}

            ids = resp.json()[:limit]
            stories = []
            for item_id in ids:
                try:
                    item_url = f"https://hacker-news.firebaseio.com/v0/item/{item_id}.json"
                    item_resp = self.session.get(item_url, timeout=3.5)
                    if item_resp.status_code == 200:
                        it = item_resp.json()
                        stories.append({
                            "id": item_id,
                            "title": it.get("title", ""),
                            "url": it.get("url", f"https://news.ycombinator.com/item?id={item_id}"),
                            "score": it.get("score", 0),
                            "by": it.get("by", "")
                        })
                except Exception:
                    continue

            summary_lines = ["Топ-новости Hacker News:"]
            for idx, s in enumerate(stories, 1):
                summary_lines.append(f"{idx}. {s['title']} ({s['score']} pts) — {s['url']}")

            return {
                "success": True,
                "service": "Hacker News",
                "stories": stories,
                "text_summary": "\n".join(summary_lines)
            }
        except Exception as e:
            return {"success": False, "error": f"Ошибка Hacker News: {e}"}

    # --- 7. NEWS FEEDS & SEARCH (Google News RSS & GDELT with auto-fallback) ---
    def fetch_google_news(self, query: str = "новости", limit: int = 5) -> Dict[str, Any]:
        """Fetch real-time news via Google News RSS (zero rate limits, works in Russian and any language)."""
        try:
            encoded = requests.utils.quote(query)
            has_cyrillic = bool(re.search(r'[\u0400-\u04FF]', query))
            if has_cyrillic:
                url = f"https://news.google.com/rss/search?q={encoded}&hl=ru&gl=RU&ceid=RU:ru"
            else:
                url = f"https://news.google.com/rss/search?q={encoded}&hl=en-US&gl=US&ceid=US:en"

            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            }
            resp = self.session.get(url, headers=headers, timeout=5.0)
            if resp.status_code == 200:
                root = ET.fromstring(resp.content)
                articles = []
                for it in root.findall(".//item")[:limit]:
                    title = it.findtext("title", "Без названия")
                    link = it.findtext("link", "")
                    pub_date = it.findtext("pubDate", "")
                    source_el = it.find("source")
                    domain = source_el.text if source_el is not None else ""
                    if not domain and " - " in title:
                        parts = title.rsplit(" - ", 1)
                        title = parts[0]
                        domain = parts[1]
                    articles.append({
                        "title": title.strip(),
                        "url": link.strip(),
                        "domain": domain.strip() if domain else "Медиа",
                        "date": pub_date.strip()
                    })

                if articles:
                    lines = [f"Свежие новости по теме '{query}' ({len(articles)} статей):"]
                    for idx, a in enumerate(articles, 1):
                        lines.append(f"{idx}. {a['title']} [{a['domain']}] — {a['url']}")
                    return {
                        "success": True,
                        "service": "Google News (Live Feed)",
                        "query": query,
                        "articles": articles,
                        "text_summary": "\n".join(lines)
                    }
        except Exception as e:
            logger.warning(f"Google News RSS error: {e}")
        return {"success": False, "error": f"Не удалось загрузить новости по теме '{query}'"}

    def fetch_gdelt(self, query: str = "technology", limit: int = 5, timeout: float = 3.0) -> Dict[str, Any]:
        """Query GDELT 2.0 Doc API for global media trend analysis with short timeout."""
        try:
            url = f"https://api.gdeltproject.org/api/v2/doc/doc?query={requests.utils.quote(query)}&mode=artlist&maxrecords={limit}&format=json"
            resp = self.session.get(url, timeout=timeout)
            if resp.status_code == 200:
                data = resp.json().get("articles", [])
                articles = []
                for a in data:
                    articles.append({
                        "title": a.get("title", ""),
                        "url": a.get("url", ""),
                        "domain": a.get("domain", ""),
                        "date": a.get("seendate", "")
                    })

                if articles:
                    lines = [f"Мировые новости по теме '{query}' (GDELT Project):"]
                    for idx, a in enumerate(articles, 1):
                        lines.append(f"{idx}. {a['title']} [{a['domain']}] — {a['url']}")

                    return {
                        "success": True,
                        "service": "GDELT Project",
                        "articles": articles,
                        "text_summary": "\n".join(lines)
                    }
        except Exception as e:
            logger.info(f"GDELT API fast-timeout or error ({e}), switching to Google News fallback")

        return {"success": False, "error": f"GDELT offline/timeout"}

    def fetch_news_search(self, query: str = "новости", limit: int = 5) -> Dict[str, Any]:
        """Smart multi-source news dispatcher: uses Google News RSS (zero rate limits) and GDELT fallback."""
        # Cyrillic topics or general searches -> Google News is fast (<2s) and 100% reliable
        res = self.fetch_google_news(query, limit)
        if res.get("success") and res.get("articles"):
            return res

        # Fallback to GDELT
        gdelt_res = self.fetch_gdelt(query, limit, timeout=3.5)
        if gdelt_res.get("success") and gdelt_res.get("articles"):
            return gdelt_res

        return res

    # --- 8. UNIVERSAL RSS/ATOM XML PARSER ---
    def fetch_rss_feed(self, url: str, limit: int = 5) -> Dict[str, Any]:
        """Fetch and parse any RSS 2.0 or Atom XML feed without external heavy libraries."""
        try:
            resp = self.session.get(url, timeout=6)
            if resp.status_code != 200:
                return {"success": False, "error": f"HTTP {resp.status_code} при загрузке RSS ленты"}

            root = ET.fromstring(resp.content)
            items = []

            # Check RSS 2.0 channel/item
            channel = root.find("channel")
            if channel is not None:
                feed_title = channel.findtext("title", "RSS Feed")
                for it in channel.findall("item")[:limit]:
                    title = it.findtext("title", "Без названия")
                    link = it.findtext("link", "")
                    pub_date = it.findtext("pubDate", "")
                    desc = it.findtext("description", "")
                    desc_clean = re.sub(r'<[^>]+>', ' ', desc).strip()[:180]
                    items.append({
                        "title": title.strip(),
                        "link": link.strip(),
                        "date": pub_date.strip(),
                        "summary": desc_clean
                    })
            else:
                # Check Atom feed/entry
                feed_title = root.findtext("{http://www.w3.org/2005/Atom}title", "Atom Feed")
                for it in root.findall("{http://www.w3.org/2005/Atom}entry")[:limit]:
                    title = it.findtext("{http://www.w3.org/2005/Atom}title", "Без названия")
                    link_el = it.find("{http://www.w3.org/2005/Atom}link")
                    link = link_el.attrib.get("href", "") if link_el is not None else ""
                    summary = it.findtext("{http://www.w3.org/2005/Atom}summary", "") or it.findtext("{http://www.w3.org/2005/Atom}content", "")
                    items.append({
                        "title": title.strip(),
                        "link": link.strip(),
                        "summary": summary[:180].strip()
                    })

            lines = [f"Лента: {feed_title} ({len(items)} записей):"]
            for idx, it in enumerate(items, 1):
                lines.append(f"{idx}. {it['title']}\n   Ссылка: {it['link']}")

            return {
                "success": True,
                "service": "RSS Parser",
                "feed_title": feed_title,
                "count": len(items),
                "items": items,
                "text_summary": "\n".join(lines)
            }
        except Exception as e:
            return {"success": False, "error": f"Ошибка парсинга RSS XML: {e}"}

    # --- 9. CUSTOM USER APIS ---
    def fetch_custom_api(self, api_item: Dict[str, Any], query: str = "") -> Dict[str, Any]:
        """Execute request to a user-configured custom API endpoint."""
        try:
            url_template = api_item.get("url", "")
            method = api_item.get("method", "GET").upper()
            key = api_item.get("key", "").strip()
            auth_type = api_item.get("auth_type", "param")
            auth_header = api_item.get("auth_header", "X-Api-Key").strip()

            encoded_query = requests.utils.quote(query) if query else ""
            target_url = url_template.replace("{query}", encoded_query).replace("{key}", key)

            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SREDA-AI/7.0"
            }
            if key:
                if auth_type == "bearer":
                    headers["Authorization"] = f"Bearer {key}"
                elif auth_type == "header":
                    headers[auth_header] = key
                elif auth_type == "param" and "{key}" not in url_template:
                    sep = "&" if "?" in target_url else "?"
                    target_url += f"{sep}key={key}"

            timeout = 7.0
            if method == "POST":
                resp = self.session.post(target_url, headers=headers, json={"query": query}, timeout=timeout)
            else:
                resp = self.session.get(target_url, headers=headers, timeout=timeout)

            if resp.status_code >= 400:
                return {
                    "success": False,
                    "error": f"API вернул ошибку HTTP {resp.status_code}: {resp.text[:180]}"
                }

            try:
                data = resp.json()
                text_summary = json.dumps(data, ensure_ascii=False, indent=2)
                if len(text_summary) > 600:
                    text_summary = text_summary[:600] + "...\n[данные обрезаны]"
                return {
                    "success": True,
                    "service": api_item.get("name", "Custom API"),
                    "category": api_item.get("category", "custom"),
                    "data": data,
                    "text_summary": f"Данные от {api_item.get('name')}:\n{text_summary}"
                }
            except Exception:
                return {
                    "success": True,
                    "service": api_item.get("name", "Custom API"),
                    "category": api_item.get("category", "custom"),
                    "text_summary": resp.text[:600]
                }
        except Exception as e:
            return {"success": False, "error": f"Ошибка вызова Custom API: {e}"}

    # --- 10. UNIVERSAL DISPATCHER ---
    def fetch_live_data(self, source: str, query: str = "", limit: Optional[int] = None) -> Dict[str, Any]:
        """Dispatch data request to the appropriate service with dynamic limit (1..10, default 7)."""
        s = source.lower().strip()
        clean_query = (query or "").strip()

        # Extract limit from query if not specified
        effective_limit = limit
        if not effective_limit or effective_limit <= 0:
            m = re.search(r'(?:топ|top)[-\s]*(\d+)|(\d+)[-\s]*(?:новост|статей|главн|записей)', clean_query, re.IGNORECASE)
            if m:
                effective_limit = int(m.group(1) or m.group(2))
            else:
                effective_limit = 7
        effective_limit = min(max(effective_limit, 1), 10)

        # Strip 'топ N новостей по/про/о' from topic query to maximize search quality
        topic_query = re.sub(r'^(?:топ|top)[-\s]*\d+[-\s]*(?:новост[ей|и|ь]*\s*(?:по|про|о)?\s*)?', '', clean_query, flags=re.IGNORECASE).strip()
        topic_query = re.sub(r'[\.,].*$', '', topic_query).strip()
        if not topic_query:
            topic_query = clean_query

        if s in ["crypto", "крипта", "биткоин"]:
            return self.fetch_crypto(topic_query or "bitcoin")
        elif s in ["stocks", "акции", "рынок", "биржа"]:
            return self.fetch_stocks(topic_query or "AAPL")
        elif s in ["rates", "валюты", "курс"]:
            return self.fetch_rates(topic_query or "USD")
        elif s in ["weather", "погода"]:
            return self.fetch_weather(topic_query or "Москва")
        elif s in ["country", "страна"]:
            return self.fetch_country(topic_query or "Россия")
        elif s in ["hackernews", "hn"]:
            return self.fetch_hacker_news(effective_limit)
        elif s in ["gdelt", "news", "новости", "сми", "feed"]:
            return self.fetch_news_search(topic_query or "новости", effective_limit)
        elif s in ["rss"]:
            return self.fetch_rss_feed(clean_query, effective_limit)

        # Check custom APIs
        for capi in self.config.get("custom_apis", []):
            if capi.get("enabled", True):
                if s in [capi.get("id", "").lower(), capi.get("name", "").lower(), capi.get("category", "").lower()]:
                    return self.fetch_custom_api(capi, topic_query)

        return {"success": False, "error": f"Неизвестный источник данных: '{source}'"}
