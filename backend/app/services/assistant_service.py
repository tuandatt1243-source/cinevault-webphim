from __future__ import annotations

import asyncio
import json
import logging
import re
import time
import unicodedata
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
from bson import ObjectId
from pymongo import DESCENDING
from pymongo.asynchronous.database import AsyncDatabase

from app.core.config import get_settings
from app.core.sanitize import safe_regex_pattern
from app.services.serializers import serialize_movie

logger = logging.getLogger("cinevault.assistant")

GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
GEMINI_FALLBACK_MODELS = (
    "gemini-3.5-flash-lite",
    "gemini-3.6-flash",
    "gemini-3-flash-preview",
)
GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"


def _gemini_model_chain(primary: str) -> list[str]:
    chain: list[str] = []
    for m in (primary, *GEMINI_FALLBACK_MODELS):
        if m and m not in chain:
            chain.append(m)
    return chain


def _gemini_generation_config(model_name: str, base_cfg: dict[str, Any]) -> dict[str, Any]:
    cfg = dict(base_cfg)
    # Use minimal thinking on Gemini 3.x Flash models so RAG replies stay snappy (~1.5-2.5s)
    if model_name.startswith("gemini-3"):
        cfg["thinkingConfig"] = {"thinkingLevel": "minimal"}
    return cfg

# Rich Vietnamese & English cinema intent dictionary -> canonical MongoDB genres
# Uses strict word-boundary matching so short tokens never collide with unrelated words
# (e.g. "ma" inside "animation" or Vietnamese "mà").
GENRE_KEYWORDS: list[tuple[tuple[str, ...], list[str]]] = [
    (
        (
            "hoat hinh", "anime", "animes", "ghibli", "pixar", "disney",
            "animation", "animations", "animated", "cartoon", "cartoons",
        ),
        ["Animation"],
    ),
    (
        (
            "kinh di", "phim ma", "ma am", "rung ron", "am anh", "horror", "horrors", "scary",
            "slasher", "zombie", "zombies", "vampire", "ghost", "supernatural",
        ),
        ["Horror"],
    ),
    (
        (
            "toi pham", "tam ly toi pham", "mafia", "xa hoi den", "sat nhan",
            "crime", "gangster", "heist", "noir", "film-noir",
        ),
        ["Crime", "Film-Noir"],
    ),
    (
        (
            "giat gan", "cang thang", "trinh tham", "bi an", "thriller", "thrillers",
            "mystery", "mysteries", "suspense", "detective",
        ),
        ["Thriller", "Mystery"],
    ),
    (
        (
            "khoa hoc vien tuong", "sci-fi", "scifi", "science fiction",
            "du hanh thoi gian", "vu tru", "cyberpunk", "khong gian",
            "space", "alien", "aliens", "time travel", "dystopian",
        ),
        ["Sci-Fi"],
    ),
    (
        (
            "hack nao", "xoan nao", "dau tri", "mind-bend", "mind bend",
            "mindbend", "mind-bending", "plot twist",
        ),
        ["Sci-Fi", "Mystery", "Thriller"],
    ),
    (
        (
            "hanh dong", "man nhan", "danh nhau", "ban sung", "sieu anh hung",
            "action", "superhero", "adrenaline",
        ),
        ["Action"],
    ),
    (
        ("phieu luu", "tham hiem", "adventure", "adventures"),
        ["Adventure"],
    ),
    (
        ("chien tranh", "war movie", "war film", "world war", "ww2", "battlefield"),
        ["War"],
    ),
    (
        ("tinh cam", "lang man", "tinh yeu", "romance", "romantic", "love story"),
        ["Romance"],
    ),
    (
        (
            "chinh kich", "cam dong", "sau lang", "chua lanh", "nhan van",
            "drama", "dramas", "emotional", "heartwarming", "tearjerker",
        ),
        ["Drama"],
    ),
    (
        ("gia dinh", "tre em", "family", "kids"),
        ["Family"],
    ),
    (
        ("phim hai", "hai huoc", "cuoi", "vui nhon", "giai tri", "comedy", "comedies", "funny", "hilarious"),
        ["Comedy"],
    ),
    (
        ("am nhac", "nhac kich", "ca nhac", "music", "musical", "musicals", "jazz"),
        ["Music", "Musical"],
    ),
    (
        ("lich su", "tieu su", "co trang", "co that", "history", "historical", "biography", "biopic"),
        ["History", "Biography"],
    ),
    (
        ("the thao", "bong da", "quyen anh", "boxing", "sport", "sports", "racing"),
        ["Sport"],
    ),
    (
        ("vien tay", "cao boi", "western", "westerns", "cowboy"),
        ["Western"],
    ),
    (
        ("gia tuong", "phep thuat", "fantasy", "than thoai"),
        ["Fantasy"],
    ),
    (
        ("tai lieu", "phim tai lieu", "documentary", "documentaries"),
        ["Documentary"],
    ),
]

WELL_KNOWN_PEOPLE: list[tuple[str, str, str]] = [
    ("christopher nolan", "Christopher Nolan", "director"),
    ("nolan", "Christopher Nolan", "director"),
    ("quentin tarantino", "Quentin Tarantino", "director"),
    ("tarantino", "Quentin Tarantino", "director"),
    ("martin scorsese", "Martin Scorsese", "director"),
    ("scorsese", "Martin Scorsese", "director"),
    ("david fincher", "David Fincher", "director"),
    ("fincher", "David Fincher", "director"),
    ("hayao miyazaki", "Hayao Miyazaki", "director"),
    ("miyazaki", "Hayao Miyazaki", "director"),
    ("steven spielberg", "Steven Spielberg", "director"),
    ("spielberg", "Steven Spielberg", "director"),
    ("stanley kubrick", "Stanley Kubrick", "director"),
    ("kubrick", "Stanley Kubrick", "director"),
    ("alfred hitchcock", "Alfred Hitchcock", "director"),
    ("hitchcock", "Alfred Hitchcock", "director"),
    ("denis villeneuve", "Denis Villeneuve", "director"),
    ("villeneuve", "Denis Villeneuve", "director"),
    ("bong joon", "Bong Joon Ho", "director"),
    ("francis ford coppola", "Francis Ford Coppola", "director"),
    ("coppola", "Francis Ford Coppola", "director"),
    ("akira kurosawa", "Akira Kurosawa", "director"),
    ("kurosawa", "Akira Kurosawa", "director"),
    ("ridley scott", "Ridley Scott", "director"),
    ("peter jackson", "Peter Jackson", "director"),
    ("james cameron", "James Cameron", "director"),
    ("leonardo dicaprio", "Leonardo DiCaprio", "actor"),
    ("dicaprio", "Leonardo DiCaprio", "actor"),
    ("tom hanks", "Tom Hanks", "actor"),
    ("al pacino", "Al Pacino", "actor"),
    ("robert de niro", "Robert De Niro", "actor"),
    ("brad pitt", "Brad Pitt", "actor"),
    ("christian bale", "Christian Bale", "actor"),
    ("morgan freeman", "Morgan Freeman", "actor"),
    ("keanu reeves", "Keanu Reeves", "actor"),
    ("heath ledger", "Heath Ledger", "actor"),
    ("joaquin phoenix", "Joaquin Phoenix", "actor"),
    ("meryl streep", "Meryl Streep", "actor"),
]

FOLLOWUP_MORE_PHRASES = (
    "phim khac", "them phim", "doi phim", "goi y them", "nua di", "con phim nao khac",
    "more movies", "another", "different ones", "other options", "next",
)

SHORTER_PHRASES = ("ngan hon", "it thoi gian hon", "shorter", "quicker")


def _fold_ascii(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text.lower())
    stripped = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    return stripped.replace("đ", "d")


def _has_phrase(folded_text: str, phrase: str) -> bool:
    """Match a keyword or multi-word phrase strictly on word boundaries."""
    return bool(re.search(rf"(?<![a-z0-9]){re.escape(phrase)}(?![a-z0-9])", folded_text))


def _extract_local_intent(message: str) -> dict[str, Any]:
    folded = _fold_ascii(message)
    intent: dict[str, Any] = {
        "genres": [],
        "max_runtime": None,
        "min_runtime": None,
        "year_from": None,
        "year_to": None,
        "min_rating": None,
        "min_imdb": None,
        "director": None,
        "actor": None,
        "similar_to": None,
        "is_more_request": any(_has_phrase(folded, p) for p in FOLLOWUP_MORE_PHRASES),
        "wants_shorter": any(_has_phrase(folded, p) for p in SHORTER_PHRASES),
        "raw_query": message.strip(),
    }

    # 1. Detect "giống / tương tự / kiểu / similar to / movies like <Movie Title>"
    sim_match = re.search(
        r"(?:giống phim|giống|tương tự|kiểu như|kiểu|như phim|similar to|movies like|films like)\s+([A-Za-z0-9À-ỹ\s:'\-·&]{2,55})",
        message,
        flags=re.IGNORECASE,
    )
    if sim_match:
        cand = sim_match.group(1).strip()
        # Trim trailing Vietnamese filter clauses
        cand = re.split(
            r"\b(?:dưới|trên|nhưng|mà|với|thập niên|trước|sau|điểm|ngắn|dài|nhé|nha|đi|under|with|from)\b",
            cand,
            maxsplit=1,
            flags=re.IGNORECASE,
        )[0].strip(" ,.?!\"'")
        if len(cand) >= 2:
            intent["similar_to"] = cand

    # 2. Detect genres strictly on word boundaries
    matched_genres: list[str] = []
    for phrases, mapped in GENRE_KEYWORDS:
        if any(_has_phrase(folded, p) for p in phrases):
            for g in mapped:
                if g not in matched_genres:
                    matched_genres.append(g)
    intent["genres"] = matched_genres

    # 3. Detect runtime constraints
    # Hours: "dưới 2 tiếng", "dưới 1.5 tiếng", "under 2 hours", "2h"
    hr_under = re.search(r"(?:duoi|under|<|<=|khong qua|toi da|it hon)\s*(\d+(?:[.,]\d+)?)\s*(?:tieng|gio|h|hour|hours)\b", folded)
    min_under = re.search(r"(?:duoi|under|<|<=|khong qua|toi da|it hon)\s*(\d{2,3})\s*(?:phut|p|min|mins|minutes)?\b", folded)
    hr_over = re.search(r"(?:tren|hon|over|>|>=|it nhat)\s*(\d+(?:[.,]\d+)?)\s*(?:tieng|gio|h|hour|hours)\b", folded)
    min_over = re.search(r"(?:tren|hon|over|>|>=)\s*(\d{2,3})\s*(?:phut|p|min|mins)\b", folded)

    if hr_under:
        hrs = float(hr_under.group(1).replace(",", "."))
        # Handle "2 tiếng rưỡi" -> +30 min
        bonus = 30 if "ruoi" in folded[hr_under.end() : hr_under.end() + 10] else 0
        intent["max_runtime"] = int(hrs * 60) + bonus
    elif min_under:
        val = int(min_under.group(1))
        if 40 <= val <= 300:
            intent["max_runtime"] = val
    elif any(_has_phrase(folded, k) for k in ("xem gon", "xem nhanh", "phim ngan", "quick watch", "short movie")):
        intent["max_runtime"] = 100

    if hr_over:
        hrs = float(hr_over.group(1).replace(",", "."))
        bonus = 30 if "ruoi" in folded[hr_over.end() : hr_over.end() + 10] else 0
        intent["min_runtime"] = int(hrs * 60) + bonus
    elif min_over:
        val = int(min_over.group(1))
        if 40 <= val <= 300:
            intent["min_runtime"] = val

    # 4. Detect era / decade / year
    dec_match = re.search(r"(?:thap nien|nhung nam|decade|in the)\s*(19\d0|20\d0|\d0)s?", folded)
    if dec_match:
        raw_d = dec_match.group(1)
        dec = int(raw_d) if len(raw_d) == 4 else (2000 + int(raw_d) if int(raw_d) <= 20 else 1900 + int(raw_d))
        intent["year_from"] = dec
        intent["year_to"] = dec + 9
    else:
        before_y = re.search(r"(?:truoc|before)\s*(19\d{2}|20\d{2})", folded)
        after_y = re.search(r"(?:sau|tu nam|tu|after|since)\s*(19\d{2}|20\d{2})", folded)
        if before_y:
            intent["year_to"] = int(before_y.group(1))
        if after_y:
            intent["year_from"] = int(after_y.group(1))
        elif any(_has_phrase(folded, k) for k in ("kinh dien", "co dien", "classic", "phim xua", "black and white", "den trang")):
            intent["year_to"] = 1999
        elif any(_has_phrase(folded, k) for k in ("gan day", "hien dai", "moi nhat", "recent", "modern")):
            intent["year_from"] = 2010

    # 5. Detect rating thresholds
    star_match = re.search(r"(?:tren|tu|>=|>)\s*(\d(?:[.,]\d)?)\s*(?:sao|star|diem)", folded)
    imdb_match = re.search(r"imdb\s*(?:tren|tu|>=|>)?\s*(\d(?:[.,]\d)?)", folded)
    if imdb_match:
        val = float(imdb_match.group(1).replace(",", "."))
        if 0.0 < val <= 10.0:
            intent["min_imdb"] = val
    if star_match:
        val = float(star_match.group(1).replace(",", "."))
        if 1.0 <= val <= 5.0:
            intent["min_rating"] = val
        elif 5.0 < val <= 10.0:
            intent["min_imdb"] = val
    elif any(_has_phrase(folded, k) for k in ("diem cao", "xuat sac", "kiet tac", "hay nhat", "top rated", "masterpiece")):
        intent["min_rating"] = 4.0

    # 6. Detect well-known directors/actors strictly on word boundaries
    for needle, canonical, role in WELL_KNOWN_PEOPLE:
        if _has_phrase(folded, needle):
            if role == "director":
                intent["director"] = canonical
            else:
                intent["actor"] = canonical
            break

    return intent


async def _enhance_intent_with_gemini(message: str, api_key: str, model: str) -> dict[str, Any] | None:
    """Optional fast structured intent parser via Gemini when local rules find no explicit genre/person."""
    prompt = (
        "Extract movie search filters from the user's request into strict JSON ONLY (no markdown). "
        "Allowed genres: Action, Adventure, Animation, Biography, Comedy, Crime, Drama, Family, Fantasy, "
        "Film-Noir, History, Horror, Music, Musical, Mystery, Romance, Sci-Fi, Sport, Thriller, War, Western. "
        'JSON schema: {"genres": string[], "max_runtime": int|null, "year_from": int|null, "year_to": int|null, '
        '"director": string|null, "actor": string|null, "similar_to": string|null, "keywords": string[]}\n'
        f"User request: {message}"
    )
    base_gen_cfg = {"temperature": 0.1, "responseMimeType": "application/json", "maxOutputTokens": 220}
    async with httpx.AsyncClient(timeout=7.0) as client:
        for candidate_model in _gemini_model_chain(model)[:2]:
            url = f"{GEMINI_API_BASE}/{candidate_model}:generateContent"
            payload = {
                "contents": [{"role": "user", "parts": [{"text": prompt}]}],
                "generationConfig": _gemini_generation_config(candidate_model, base_gen_cfg),
            }
            try:
                resp = await client.post(url, params={"key": api_key}, json=payload)
                if resp.status_code != 200:
                    continue
                data = resp.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text)
                if isinstance(parsed, dict):
                    return parsed
            except Exception as exc:
                logger.debug("Gemini intent enhancement skipped on %s: %s %s", candidate_model, type(exc).__name__, exc)
    return None


async def _generate_gemini_reply(
    *,
    message: str,
    lang: str,
    movies: list[dict[str, Any]],
    similar_seed: dict[str, Any] | None,
    history: list[dict[str, Any]],
    api_key: str,
    model: str,
) -> str | None:
    """Generate a grounded editorial curator response citing ONLY the MongoDB-retrieved movies."""
    lang_name = {
        "vi": "Vietnamese",
        "en": "English",
        "ja": "Japanese",
        "ko": "Korean",
        "fr": "French",
        "zh": "Simplified Chinese",
    }.get(lang, "Vietnamese")

    catalog_context = [
        {
            "title": m["title"],
            "year": m["release_year"],
            "runtime_minutes": m["runtime_minutes"],
            "genres": m["genres"],
            "directors": m["directors"],
            "avg_rating": m["avg_rating"],
            "imdb_rating": m.get("imdb_rating"),
            "overview": (m.get("overview_i18n") or {}).get(lang) or m.get("overview", "")[:220],
        }
        for m in movies
    ]

    recent_turns = [
        f"{h['role'].upper()}: {h['content'][:160]}"
        for h in history[-4:]
    ]

    system_text = (
        f"You are Tito Concierge, an editorial cinema curator for Titofilm. Reply ONLY in {lang_name}. "
        "CRITICAL GROUNDING RULE: Recommend ONLY films present in the provided MongoDB catalog results below. "
        "Never invent or mention movies outside that list. Keep your reply concise (3-5 short sentences or clean bullet points), "
        "warm, insightful about cinema mood/direction, and explain briefly why these exact titles fit the user's request. "
        "Do not use emojis or generic AI filler phrases."
    )

    user_prompt = (
        f"Recent conversation:\n{chr(10).join(recent_turns) or '(new session)'}\n\n"
        f"User request: {message}\n"
        f"Reference film (if any): {similar_seed['title'] if similar_seed else 'None'}\n\n"
        f"MongoDB Retrieved Movies ({len(catalog_context)}):\n"
        f"{json.dumps(catalog_context, ensure_ascii=False)}"
    )

    base_gen_cfg = {"temperature": 0.65, "maxOutputTokens": 420}
    candidates = _gemini_model_chain(model)[:2]

    async def _call_model(client: httpx.AsyncClient, candidate_model: str) -> str | None:
        url = f"{GEMINI_API_BASE}/{candidate_model}:generateContent"
        payload = {
            "systemInstruction": {"parts": [{"text": system_text}]},
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
            "generationConfig": _gemini_generation_config(candidate_model, base_gen_cfg),
        }
        try:
            resp = await client.post(url, params={"key": api_key}, json=payload)
            if resp.status_code != 200:
                logger.warning("Gemini %s HTTP %s", candidate_model, resp.status_code)
                return None
            data = resp.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            return text or None
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("Gemini %s failed (%s: %s)", candidate_model, type(exc).__name__, exc)
            return None

    async with httpx.AsyncClient(timeout=7.0) as client:
        # Hedge the top 2 fast models in parallel: first valid 200 wins in ~1-2s,
        # shielding users from transient single-model 503/latency spikes.
        pending = {asyncio.create_task(_call_model(client, m)) for m in candidates}
        try:
            while pending:
                done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
                for task in done:
                    result = task.result()
                    if result:
                        return result
        finally:
            for task in pending:
                task.cancel()
            if pending:
                await asyncio.gather(*pending, return_exceptions=True)
    return None


async def _generate_groq_reply(
    *,
    message: str,
    lang: str,
    movies: list[dict[str, Any]],
    similar_seed: dict[str, Any] | None,
    history: list[dict[str, Any]],
    api_key: str,
    model: str,
) -> str | None:
    """Generate a grounded editorial curator response via Groq OpenAI-compatible API."""
    lang_name = {
        "vi": "Vietnamese",
        "en": "English",
        "ja": "Japanese",
        "ko": "Korean",
        "fr": "French",
        "zh": "Simplified Chinese",
    }.get(lang, "Vietnamese")

    catalog_context = [
        {
            "title": m["title"],
            "year": m["release_year"],
            "runtime_minutes": m["runtime_minutes"],
            "genres": m["genres"],
            "directors": m["directors"],
            "avg_rating": m["avg_rating"],
            "imdb_rating": m.get("imdb_rating"),
            "overview": (m.get("overview_i18n") or {}).get(lang) or m.get("overview", "")[:220],
        }
        for m in movies
    ]

    system_text = (
        f"You are Tito Concierge, an editorial cinema curator for Titofilm. Reply ONLY in {lang_name}. "
        "CRITICAL GROUNDING RULE: Recommend ONLY films present in the provided MongoDB catalog results. "
        "Never invent movies outside that list. Keep your reply concise (3-5 short sentences), warm, insightful "
        "about cinema mood/direction, and explain briefly why these exact titles fit the user's request. No emojis."
    )
    recent_turns = [f"{h['role'].upper()}: {h['content'][:160]}" for h in history[-4:]]
    user_prompt = (
        f"Recent conversation:\n{chr(10).join(recent_turns) or '(new session)'}\n\n"
        f"User request: {message}\n"
        f"Reference film: {similar_seed['title'] if similar_seed else 'None'}\n\n"
        f"MongoDB Retrieved Movies ({len(catalog_context)}):\n"
        f"{json.dumps(catalog_context, ensure_ascii=False)}"
    )

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.post(
                GROQ_CHAT_URL,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_text},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.65,
                    "max_tokens": 420,
                },
            )
            if resp.status_code != 200:
                logger.warning("Groq chat HTTP %s", resp.status_code)
                return None
            data = resp.json()
            text = data["choices"][0]["message"]["content"].strip()
            return text or None
    except Exception as exc:
        logger.warning("Groq reply fallback to MongoDB curator: %s", exc)
        return None


def _build_local_curator_reply(
    *,
    lang: str,
    movies: list[dict[str, Any]],
    similar_seed: dict[str, Any] | None,
    intent: dict[str, Any],
) -> str:
    if not movies:
        if lang == "en":
            return "I couldn’t find an exact match in the Titofilm archive. Try loosening the runtime or decade filter."
        return "Mình chưa tìm thấy phim khớp chính xác tiêu chí này trong kho Titofilm. Bạn thử nới nhẹ thời lượng hoặc đổi thể loại xem nhé."

    top_names = ", ".join(f"{m['title']} ({m['release_year']})" for m in movies[:3])

    if lang == "en":
        if similar_seed:
            return (
                f"Based on the tone and genre DNA of {similar_seed['title']}, I pulled {len(movies)} closely matched "
                f"titles from Titofilm’s catalog — led by {top_names}. Click any card below to watch its HD trailer or read ratings."
            )
        notes = []
        if intent.get("director"):
            notes.append(f"directed by {intent['director']}")
        if intent.get("actor"):
            notes.append(f"starring {intent['actor']}")
        if intent.get("max_runtime"):
            notes.append(f"under {intent['max_runtime']} minutes")
        if intent.get("year_from") and intent.get("year_to"):
            notes.append(f"from {intent['year_from']}–{intent['year_to']}")
        elif intent.get("year_to"):
            notes.append(f"released before {intent['year_to']}")
        elif intent.get("year_from"):
            notes.append(f"from {intent['year_from']} onward")
        criteria = f" ({', '.join(notes)})" if notes else ""
        return (
            f"Here are {len(movies)} standout picks from the Titofilm archive{criteria}: {top_names}. "
            "You can preview any HD trailer directly or ask me for shorter, darker, or more classic options."
        )

    # Default natural Vietnamese cinema curator voice
    if similar_seed:
        return (
            f"Dựa trên không khí và thể loại của **{similar_seed['title']}**, mình đã truy xuất {len(movies)} tác phẩm "
            f"cùng tần số nhất trong kho Titofilm — nổi bật là {top_names}. Bạn bấm trực tiếp vào thẻ phim bên dưới để xem Trailer HD hoặc chi tiết nhé."
        )

    criteria_parts: list[str] = []
    if intent.get("director"):
        criteria_parts.append(f"của đạo diễn {intent['director']}")
    if intent.get("actor"):
        criteria_parts.append(f"có {intent['actor']} tham gia")
    if intent.get("max_runtime"):
        criteria_parts.append(f"thời lượng dưới {intent['max_runtime']} phút")
    if intent.get("min_runtime"):
        criteria_parts.append(f"thời lượng trên {intent['min_runtime']} phút")
    if intent.get("year_from") and intent.get("year_to"):
        criteria_parts.append(f"giai đoạn {intent['year_from']}–{intent['year_to']}")
    elif intent.get("year_to"):
        criteria_parts.append(f"kinh điển trước năm {intent['year_to']}")
    elif intent.get("year_from"):
        criteria_parts.append(f"từ năm {intent['year_from']} trở lại đây")
    if intent.get("min_rating"):
        criteria_parts.append(f"điểm cộng đồng từ {intent['min_rating']}★")
    elif intent.get("min_imdb"):
        criteria_parts.append(f"IMDb từ {intent['min_imdb']}")

    criteria_str = f" ({', '.join(criteria_parts)})" if criteria_parts else ""
    return (
        f"Mình vừa lọc ra {len(movies)} bộ phim khớp gu bạn nhất từ kho Titofilm{criteria_str}, dẫn đầu là {top_names}. "
        "Bạn có thể xem nhanh Trailer HD ngay bên dưới hoặc nhắn thêm (ví dụ: 'ngắn hơn chút' hay 'đổi phim khác')."
    )


def _build_follow_ups(lang: str, movies: list[dict[str, Any]], intent: dict[str, Any]) -> list[str]:
    first_title = movies[0]["title"] if movies else "Inception"
    if lang == "en":
        return [
            "Show me different options",
            "Something shorter under 100 min",
            f"More films similar to {first_title}",
        ]
    return [
        "Gợi ý thêm phim khác đi",
        "Có phim nào ngắn gọn dưới 100 phút không?",
        f"Phim nào cùng vibe với {first_title}?",
    ]


def _serialize_mongo_filter(raw_filter: dict[str, Any]) -> dict[str, Any]:
    """Convert ObjectIds inside a MongoDB query filter into readable strings for transparency."""
    def _clean(val: Any) -> Any:
        if isinstance(val, ObjectId):
            return str(val)
        if isinstance(val, list):
            return [_clean(x) for x in val]
        if isinstance(val, dict):
            return {k: _clean(v) for k, v in val.items()}
        return val

    return _clean(raw_filter)


async def get_assistant_status() -> dict[str, Any]:
    settings = get_settings()
    has_gemini = bool((settings.gemini_api_key or "").strip())
    has_groq = bool((settings.groq_api_key or "").strip())
    enabled = has_gemini or has_groq
    active_model = settings.gemini_model if has_gemini else (settings.groq_model if has_groq else settings.gemini_model)
    return {
        "gemini_enabled": enabled,
        "model": active_model,
        "mode": "gemini-rag" if enabled else "mongodb-rag",
    }


async def chat_with_concierge(
    db: AsyncDatabase,
    *,
    message: str,
    session_id: str | None,
    lang: str = "vi",
    current_user: dict[str, Any] | None = None,
) -> dict[str, Any]:
    settings = get_settings()
    api_key = (settings.gemini_api_key or "").strip()
    model = settings.gemini_model

    sid = (session_id or "").strip() or f"tito-{uuid.uuid4().hex[:16]}"
    existing_session = await db.chat_sessions.find_one({"session_id": sid})
    history: list[dict[str, Any]] = list(existing_session.get("messages", [])) if existing_session else []
    prev_filters: dict[str, Any] = dict(existing_session.get("last_filters") or {}) if existing_session else {}

    previously_shown_ids: list[ObjectId] = []
    for h in history:
        for mid in h.get("movie_ids") or []:
            if ObjectId.is_valid(mid):
                previously_shown_ids.append(ObjectId(mid))

    # 1. Extract structured cinema intent
    intent = _extract_local_intent(message)

    # Carry forward previous session constraints for natural follow-ups ("phim khác", "ngắn hơn")
    if (intent["is_more_request"] or intent["wants_shorter"]) and prev_filters:
        if not intent["genres"] and prev_filters.get("genres"):
            intent["genres"] = list(prev_filters["genres"])
        if not intent["director"] and prev_filters.get("director"):
            intent["director"] = prev_filters["director"]
        if not intent["year_from"] and prev_filters.get("year_from"):
            intent["year_from"] = prev_filters["year_from"]
        if not intent["year_to"] and prev_filters.get("year_to"):
            intent["year_to"] = prev_filters["year_to"]
        if intent["wants_shorter"] and not intent["max_runtime"]:
            prev_rt = prev_filters.get("max_runtime")
            intent["max_runtime"] = max(85, int(prev_rt) - 20) if prev_rt else 105

    # If request is abstract/nuanced and Gemini key is configured, enhance intent extraction
    has_explicit_signal = any(
        [
            intent["genres"],
            intent["director"],
            intent["actor"],
            intent["similar_to"],
            intent["max_runtime"],
            intent["min_runtime"],
            intent["year_from"],
            intent["year_to"],
        ]
    )
    extra_keywords: list[str] = []
    if not has_explicit_signal and api_key:
        ai_intent = await _enhance_intent_with_gemini(message, api_key, model)
        if ai_intent:
            if ai_intent.get("genres"):
                intent["genres"] = list(ai_intent["genres"])[:4]
            if ai_intent.get("max_runtime"):
                intent["max_runtime"] = int(ai_intent["max_runtime"])
            if ai_intent.get("year_from"):
                intent["year_from"] = int(ai_intent["year_from"])
            if ai_intent.get("year_to"):
                intent["year_to"] = int(ai_intent["year_to"])
            if ai_intent.get("director"):
                intent["director"] = str(ai_intent["director"])
            if ai_intent.get("actor"):
                intent["actor"] = str(ai_intent["actor"])
            if ai_intent.get("similar_to"):
                intent["similar_to"] = str(ai_intent["similar_to"])
            if ai_intent.get("keywords"):
                extra_keywords = [str(k) for k in ai_intent["keywords"][:4]]

    # 2. Execute timed MongoDB Retrieval
    t0 = time.perf_counter()
    similar_seed: dict[str, Any] | None = None
    mongo_filter: dict[str, Any] = {"is_deleted": False}

    # Resolve reference movie if user asked "giống <Title>"
    if intent.get("similar_to"):
        seed_pat = safe_regex_pattern(intent["similar_to"])
        similar_seed = await db.movies.find_one(
            {"is_deleted": False, "title": {"$regex": seed_pat, "$options": "i"}}
        )
        if similar_seed:
            if not intent["genres"]:
                intent["genres"] = list(similar_seed.get("genres") or [])[:3]
            previously_shown_ids.append(similar_seed["_id"])

    if intent["genres"]:
        mongo_filter["genres"] = {"$in": intent["genres"]}
    if intent["max_runtime"] or intent["min_runtime"]:
        rt_cond: dict[str, int] = {}
        if intent["max_runtime"]:
            rt_cond["$lte"] = int(intent["max_runtime"])
        if intent["min_runtime"]:
            rt_cond["$gte"] = int(intent["min_runtime"])
        mongo_filter["runtime_minutes"] = rt_cond
    if intent["year_from"] or intent["year_to"]:
        yr_cond: dict[str, int] = {}
        if intent["year_from"]:
            yr_cond["$gte"] = int(intent["year_from"])
        if intent["year_to"]:
            yr_cond["$lte"] = int(intent["year_to"])
        mongo_filter["release_year"] = yr_cond
    if intent["min_rating"]:
        mongo_filter["avg_rating"] = {"$gte": float(intent["min_rating"])}
    if intent["min_imdb"]:
        mongo_filter["imdb_rating"] = {"$gte": float(intent["min_imdb"])}
    if intent["director"]:
        mongo_filter["directors"] = {"$regex": safe_regex_pattern(intent["director"]), "$options": "i"}
    if intent["actor"]:
        mongo_filter["cast"] = {"$regex": safe_regex_pattern(intent["actor"]), "$options": "i"}

    if previously_shown_ids and (intent["is_more_request"] or similar_seed is not None):
        mongo_filter["_id"] = {"$nin": previously_shown_ids}

    # If no structured filter matched at all, attempt MongoDB $text search on message / keywords
    text_query_used = False
    if len(mongo_filter) == 1 and not extra_keywords:
        text_filter = {**mongo_filter, "$text": {"$search": message}}
        text_count = await db.movies.count_documents(text_filter)
        if text_count > 0:
            mongo_filter = text_filter
            text_query_used = True
    elif extra_keywords and "genres" not in mongo_filter:
        kw_filter = {**mongo_filter, "$text": {"$search": " ".join(extra_keywords)}}
        if await db.movies.count_documents(kw_filter) > 0:
            mongo_filter = kw_filter
            text_query_used = True

    matched_count = await db.movies.count_documents(mongo_filter)

    # Graceful relaxation if filters were overly narrow
    effective_filter = dict(mongo_filter)
    if matched_count == 0 and len(effective_filter) > 1:
        for drop_key in ("avg_rating", "imdb_rating", "release_year", "_id", "runtime_minutes"):
            if drop_key in effective_filter:
                effective_filter.pop(drop_key, None)
                matched_count = await db.movies.count_documents(effective_filter)
                if matched_count > 0:
                    break
        if matched_count == 0:
            effective_filter = {"is_deleted": False}
            matched_count = await db.movies.count_documents(effective_filter)

    if text_query_used and "$text" in effective_filter:
        cursor = (
            db.movies.find(effective_filter, {"score": {"$meta": "textScore"}})
            .sort([("score", {"$meta": "textScore"}), ("views_count", DESCENDING), ("avg_rating", DESCENDING)])
            .limit(5)
        )
    else:
        cursor = (
            db.movies.find(effective_filter)
            .sort([("views_count", DESCENDING), ("avg_rating", DESCENDING), ("imdb_rating", DESCENDING)])
            .limit(5)
        )

    docs = await cursor.to_list(length=5)
    retrieval_ms = round((time.perf_counter() - t0) * 1000.0, 2)
    serialized_movies = [serialize_movie(d) for d in docs]

    # 3. Generate grounded reply (Gemini 3.8 Flash or Groq RAG if configured, else instant MongoDB curator)
    engine = "mongodb-rag"
    reply: str | None = None
    groq_key = (settings.groq_api_key or "").strip()
    if api_key and serialized_movies:
        reply = await _generate_gemini_reply(
            message=message,
            lang=lang,
            movies=serialized_movies,
            similar_seed=similar_seed,
            history=history,
            api_key=api_key,
            model=model,
        )
        if reply:
            engine = "gemini-rag"
    elif groq_key and serialized_movies:
        reply = await _generate_groq_reply(
            message=message,
            lang=lang,
            movies=serialized_movies,
            similar_seed=similar_seed,
            history=history,
            api_key=groq_key,
            model=settings.groq_model,
        )
        if reply:
            engine = "gemini-rag"

    if not reply:
        reply = _build_local_curator_reply(
            lang=lang,
            movies=serialized_movies,
            similar_seed=similar_seed,
            intent=intent,
        )

    # 4. Persist conversation as Bounded Embedded Document inside MongoDB `chat_sessions` (TTL 7 days)
    now = datetime.now(timezone.utc)
    new_entries = [
        {
            "role": "user",
            "content": message,
            "movie_ids": [],
            "engine": None,
            "retrieval_ms": None,
            "created_at": now,
        },
        {
            "role": "assistant",
            "content": reply,
            "movie_ids": [m["id"] for m in serialized_movies],
            "engine": engine,
            "retrieval_ms": retrieval_ms,
            "created_at": now,
        },
    ]

    saved_filters = {
        "genres": intent["genres"],
        "max_runtime": intent["max_runtime"],
        "year_from": intent["year_from"],
        "year_to": intent["year_to"],
        "director": intent["director"],
        "actor": intent["actor"],
    }

    user_oid = current_user["_id"] if current_user is not None else None
    await db.chat_sessions.update_one(
        {"session_id": sid},
        {
            "$push": {"messages": {"$each": new_entries, "$slice": -40}},
            "$set": {
                "user_id": user_oid,
                "last_filters": saved_filters,
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )

    return {
        "session_id": sid,
        "reply": reply,
        "movies": serialized_movies,
        "engine": engine,
        "retrieval_ms": retrieval_ms,
        "mongo_filter": _serialize_mongo_filter(effective_filter),
        "matched_count": matched_count,
        "follow_up_suggestions": _build_follow_ups(lang, serialized_movies, intent),
    }


async def get_chat_session(db: AsyncDatabase, session_id: str) -> dict[str, Any]:
    doc = await db.chat_sessions.find_one({"session_id": session_id})
    if not doc:
        return {"session_id": session_id, "messages": [], "updated_at": None}

    raw_msgs = doc.get("messages") or []
    all_oids: list[ObjectId] = []
    for msg in raw_msgs:
        for mid in msg.get("movie_ids") or []:
            if ObjectId.is_valid(mid):
                all_oids.append(ObjectId(mid))

    movies_by_id: dict[str, dict[str, Any]] = {}
    if all_oids:
        movie_docs = await db.movies.find({"_id": {"$in": all_oids}, "is_deleted": False}).to_list(length=len(all_oids))
        movies_by_id = {str(m["_id"]): serialize_movie(m) for m in movie_docs}

    out_msgs = []
    for msg in raw_msgs:
        resolved_movies = [movies_by_id[mid] for mid in (msg.get("movie_ids") or []) if mid in movies_by_id]
        out_msgs.append(
            {
                "role": msg["role"],
                "content": msg["content"],
                "movies": resolved_movies,
                "engine": msg.get("engine"),
                "retrieval_ms": msg.get("retrieval_ms"),
                "created_at": msg["created_at"],
            }
        )

    return {
        "session_id": doc["session_id"],
        "messages": out_msgs,
        "updated_at": doc.get("updated_at"),
    }


async def clear_chat_session(db: AsyncDatabase, session_id: str) -> dict[str, str]:
    await db.chat_sessions.delete_one({"session_id": session_id})
    return {"message": "Session cleared."}
