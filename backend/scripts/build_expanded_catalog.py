from __future__ import annotations

import asyncio
import csv
import json
import re
import sys
from pathlib import Path
from typing import Any

import httpx

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.sanitize import slugify

DATA_DIR = BACKEND_DIR / "data"
IMDB_CSV = DATA_DIR / "imdb_top_1000.csv"
EXTRA_JSON = DATA_DIR / "extra_imdb_movies.json"
OUT_PATH = DATA_DIR / "tmdb_expanded_movies.json"

HF_ROWS_URL = "https://datasets-server.huggingface.co/rows"
TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w500"
TMDB_BACKDROP_BASE = "https://image.tmdb.org/t/p/w1280"

GENRE_NORMALIZE = {
    "science fiction": "Sci-Fi",
    "sci-fi": "Sci-Fi",
    "action": "Action",
    "adventure": "Adventure",
    "animation": "Animation",
    "biography": "Biography",
    "comedy": "Comedy",
    "crime": "Crime",
    "drama": "Drama",
    "family": "Family",
    "fantasy": "Fantasy",
    "film-noir": "Film-Noir",
    "history": "History",
    "horror": "Horror",
    "music": "Music",
    "musical": "Musical",
    "mystery": "Mystery",
    "romance": "Romance",
    "sport": "Sport",
    "thriller": "Thriller",
    "war": "War",
    "western": "Western",
    "documentary": "Biography",
}

OVERVIEW_GENRE_HINTS: list[tuple[tuple[str, ...], str]] = [
    (("space", "planet", "alien", "future", "dystop", "robot", "time travel", "ai ", "cyber", "galaxy", "mars", "sci-fi", "multiverse"), "Sci-Fi"),
    (("killer", "murder", "detective", "investigat", "suspect", "missing", "conspiracy", "secret", "clue"), "Mystery"),
    (("haunt", "ghost", "demon", "vampire", "zombie", "curse", "evil", "terror", "nightmare", "monster", "slasher", "horror", "possess", "supernatural"), "Horror"),
    (("cartel", "mafia", "heist", "robbery", "gang", "drug", "prison", "criminal", "fbi", "cia", "hitman", "assassin", "cop", "police"), "Crime"),
    (("mission", "battle", "fight", "agent", "mercenary", "revenge", "warrior", "explosion", "chase", "superhero", "soldier", "combat", "rescue"), "Action"),
    (("journey", "quest", "expedition", "island", "treasure", "voyage", "wilderness", "explore"), "Adventure"),
    (("magic", "kingdom", "dragon", "witch", "wizard", "myth", "fairy", "enchanted", "realm"), "Fantasy"),
    (("animated", "animation", "pixar", "dreamworks", "toy", "talking ", "panda", "minion", "smurf", "spongebob", "sonic", "mario", "zootopia", "moana", "frozen", "inside out"), "Animation"),
    (("love", "romance", "wedding", "couple", "affair", "heartbreak", "marry", "dating", "relationship"), "Romance"),
    (("comedy", "hilarious", "funny", "chaos", "misadventure", "prank", "awkward", "parody", "satire"), "Comedy"),
    (("war", "world war", "battlefield", "military", "army", "nazi", "veteran"), "War"),
    (("music", "singer", "band", "concert", "pop star", "rock star", "pianist", "opera", "musical"), "Music"),
    (("true story", "biopic", "real-life", "legendary", "rise to fame", "founder", "scientist", "physicist"), "Biography"),
    (("race", "racing", "formula 1", "f1", "boxing", "football", "basketball", "tennis", "championship", "athlete", "coach"), "Sport"),
    (("survive", "survival", "trap", "hostage", "stalker", "danger", "tense", "psychological"), "Thriller"),
    (("family", "father", "mother", "daughter", "son", "brother", "sister", "childhood"), "Family"),
]


def load_existing_slugs() -> set[str]:
    slugs: set[str] = set()
    if IMDB_CSV.exists():
        with IMDB_CSV.open("r", encoding="utf-8", newline="") as f:
            for row in csv.DictReader(f):
                t = (row.get("Series_Title") or "").strip()
                y = (row.get("Released_Year") or "").strip()
                if t:
                    slugs.add(slugify(t, int(y) if y.isdigit() else 1995))
    if EXTRA_JSON.exists():
        raw = json.loads(EXTRA_JSON.read_text(encoding="utf-8"))
        for item in raw.get("movies", []):
            t = (item.get("title") or "").strip()
            y = str(item.get("year") or "").strip()
            if t and y.isdigit():
                slugs.add(slugify(t, int(y)))
    return slugs


def normalize_genres(raw: Any) -> list[str]:
    if isinstance(raw, list):
        parts = raw
    elif isinstance(raw, str):
        parts = [p.strip() for p in raw.split(",")]
    else:
        parts = []
    out: list[str] = []
    for p in parts:
        mapped = GENRE_NORMALIZE.get(str(p).strip().lower())
        if mapped and mapped not in out:
            out.append(mapped)
    return out[:4]


def infer_genres_from_text(title: str, overview: str, tagline: str = "") -> list[str]:
    hay = f" {title} {tagline} {overview} ".lower()
    out: list[str] = []
    for words, genre in OVERVIEW_GENRE_HINTS:
        if any(w in hay for w in words):
            if genre not in out:
                out.append(genre)
        if len(out) >= 3:
            break
    if not out:
        out = ["Drama"]
    return out


def upgrade_imdb_poster(url: str) -> str | None:
    cleaned = (url or "").strip()
    if not cleaned:
        return None
    return re.sub(r"\._V1_.*\.jpg$", "._V1_QL80_UX420_.jpg", cleaned)


async def fetch_hf_page(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    *,
    dataset: str,
    config: str,
    offset: int,
    length: int = 100,
) -> list[dict[str, Any]]:
    async with sem:
        for attempt in range(3):
            try:
                r = await client.get(
                    HF_ROWS_URL,
                    params={
                        "dataset": dataset,
                        "config": config,
                        "split": "train",
                        "offset": offset,
                        "length": length,
                    },
                )
                if r.status_code == 200:
                    return [item["row"] for item in r.json().get("rows", [])]
            except Exception:
                pass
            await asyncio.sleep(0.5 * (attempt + 1))
    return []


async def enrich_imdb_suggestion(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    imdb_id: str,
) -> tuple[str | None, list[str]]:
    async with sem:
        try:
            r = await client.get(
                f"https://v3.sg.media-imdb.com/suggestion/x/{imdb_id}.json",
                headers={"User-Agent": "Mozilla/5.0"},
            )
            if r.status_code != 200:
                return None, []
            entries = r.json().get("d") or []
            if not entries:
                return None, []
            entry = next((e for e in entries if e.get("id") == imdb_id), entries[0])
            raw_img = (entry.get("i") or {}).get("imageUrl")
            poster = upgrade_imdb_poster(raw_img) if raw_img else None
            stars_raw = entry.get("s") or ""
            cast = [s.strip() for s in stars_raw.split(",") if s.strip()][:5]
            return poster, cast
        except Exception:
            return None, []


async def build_catalog() -> None:
    existing_slugs = load_existing_slugs()
    print(f"Existing base catalog slugs: {len(existing_slugs)}")

    used_slugs = set(existing_slugs)
    used_titles_years: set[tuple[str, int]] = set()
    collected: list[dict[str, Any]] = []
    imdb_meta_cache: dict[str, dict[str, Any]] = {}

    sem_hf = asyncio.Semaphore(8)
    async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
        # 1. Fetch top 2,300 popular multi-era TMDB+IMDb movies from Joohnnn/TMDB-IMDB-Movies-Dataset
        print("Fetching top 2,300 movies from Joohnnn/TMDB-IMDB-Movies-Dataset...")
        joohn_pages = await asyncio.gather(
            *(
                fetch_hf_page(
                    client,
                    sem_hf,
                    dataset="Joohnnn/TMDB-IMDB-Movies-Dataset",
                    config="default",
                    offset=off,
                    length=100,
                )
                for off in range(0, 2300, 100)
            )
        )
        joohn_rows = [row for page in joohn_pages for row in page]
        print(f"Downloaded {len(joohn_rows)} rows from Joohnnn dataset.")

        joohn_added = 0
        for row in joohn_rows:
            tconst = (row.get("tconst") or "").strip()
            if tconst:
                imdb_meta_cache[tconst] = row

            if joohn_added >= 920:
                continue
            if row.get("adult") is True:
                continue
            if (row.get("status") or "Released") != "Released":
                continue

            title = (row.get("title") or "").strip()
            rel = (row.get("release_date") or "").strip()
            overview = (row.get("overview") or "").strip()
            poster_path = (row.get("poster_path") or "").strip()
            runtime = row.get("runtime") or 0

            if not title or len(rel) < 4 or not rel[:4].isdigit() or len(overview) < 25 or not poster_path:
                continue
            year = int(rel[:4])
            if not (1950 <= year <= 2026):
                continue
            try:
                runtime_int = int(float(runtime))
            except Exception:
                runtime_int = 105
            if runtime_int < 65 or runtime_int > 320:
                continue

            slug = slugify(title, year)
            if slug in used_slugs or (title.lower(), year) in used_titles_years:
                continue

            genres = normalize_genres(row.get("genres"))
            if not genres:
                genres = infer_genres_from_text(title, overview)

            directors = [d.strip() for d in str(row.get("directors") or "").split(",") if d.strip()][:3]
            cast = [c.strip() for c in str(row.get("cast") or "").split(",") if c.strip()][:6]
            imdb_rating = row.get("averageRating") or row.get("vote_average")
            try:
                imdb_val = round(min(9.9, max(5.0, float(imdb_rating))), 1)
            except Exception:
                imdb_val = 7.2
            if imdb_val < 5.8:
                continue

            votes = int(row.get("numVotes") or row.get("vote_count") or 5000)
            backdrop_path = (row.get("backdrop_path") or "").strip()

            used_slugs.add(slug)
            used_titles_years.add((title.lower(), year))
            collected.append(
                {
                    "title": title,
                    "original_title": (row.get("original_title") or title).strip()[:250],
                    "year": year,
                    "runtime": runtime_int,
                    "genres": genres,
                    "directors": directors,
                    "cast": cast,
                    "overview": overview[:1500],
                    "poster_url": f"{TMDB_POSTER_BASE}{poster_path}",
                    "backdrop_url": f"{TMDB_BACKDROP_BASE}{backdrop_path}" if backdrop_path else f"{TMDB_POSTER_BASE}{poster_path}",
                    "imdb_rating": imdb_val,
                    "votes": votes,
                    "language": (row.get("original_language") or "en").strip(),
                    "source": "tmdb-imdb",
                }
            )
            joohn_added += 1

        print(f"Selected {joohn_added} new multi-era movies from Joohnnn dataset.")

        # 2. Fetch 2021-2026 releases from NdeyeAidaNdour/tmdb-movies-2000-2026 (offsets 19600 -> 25389)
        print("Fetching 2021-2026 catalog from NdeyeAidaNdour/tmdb-movies-2000-2026...")
        nd_pages = await asyncio.gather(
            *(
                fetch_hf_page(
                    client,
                    sem_hf,
                    dataset="NdeyeAidaNdour/tmdb-movies-2000-2026",
                    config="movies",
                    offset=off,
                    length=100,
                )
                for off in range(19600, 25400, 100)
            )
        )
        nd_rows = [row for page in nd_pages for row in page]
        print(f"Downloaded {len(nd_rows)} recent rows (2021-2026).")

        by_year: dict[int, list[dict[str, Any]]] = {y: [] for y in range(2021, 2027)}
        for row in nd_rows:
            if row.get("adult") is True:
                continue
            title = (row.get("title") or "").strip()
            rel = (row.get("release_date") or "").strip()
            overview = (row.get("overview") or "").strip()
            imdb_id = (row.get("imdb_id") or "").strip()
            if not title or len(rel) < 4 or not rel[:4].isdigit() or len(overview) < 25:
                continue
            if not imdb_id.startswith("tt"):
                continue
            year = int(rel[:4])
            if year not in by_year:
                continue
            try:
                runtime_int = int(float(row.get("runtime") or 108))
            except Exception:
                runtime_int = 108
            if runtime_int < 68 or runtime_int > 280:
                continue
            votes = int(row.get("vote_count") or 0)
            pop = float(row.get("popularity") or 0.0)
            min_votes = 150 if year <= 2024 else (60 if year == 2025 else 25)
            if votes < min_votes and pop < 15.0:
                continue
            slug = slugify(title, year)
            if slug in used_slugs or (title.lower(), year) in used_titles_years:
                continue
            by_year[year].append(row)

        # Pick top ~45-55 movies per year across 2021-2026 (prioritizing high votes & popularity)
        recent_candidates: list[dict[str, Any]] = []
        per_year_quota = {2021: 42, 2022: 45, 2023: 50, 2024: 58, 2025: 55, 2026: 45}
        for y in range(2021, 2027):
            ranked = sorted(
                by_year[y],
                key=lambda r: (float(r.get("vote_count") or 0) * 1.0 + float(r.get("popularity") or 0) * 12.0),
                reverse=True,
            )
            recent_candidates.extend(ranked[: per_year_quota[y] + 15])
            print(f"  Year {y}: {len(by_year[y])} qualified -> taking top {min(len(ranked), per_year_quota[y] + 15)}")

        # Enrich recent 2021-2026 films with verified IMDb HD posters & cast
        sem_imdb = asyncio.Semaphore(14)
        enriched = await asyncio.gather(
            *(enrich_imdb_suggestion(client, sem_imdb, (r.get("imdb_id") or "").strip()) for r in recent_candidates)
        )

        recent_added_by_year = {y: 0 for y in range(2021, 2027)}
        for row, (imdb_poster, imdb_cast) in zip(recent_candidates, enriched):
            year = int(row["release_date"][:4])
            if recent_added_by_year[year] >= per_year_quota[year]:
                continue
            imdb_id = (row.get("imdb_id") or "").strip()
            j_match = imdb_meta_cache.get(imdb_id)
            poster_url = (
                f"{TMDB_POSTER_BASE}{j_match['poster_path']}"
                if j_match and j_match.get("poster_path")
                else imdb_poster
            )
            if not poster_url:
                continue

            title = row["title"].strip()
            slug = slugify(title, year)
            if slug in used_slugs or (title.lower(), year) in used_titles_years:
                continue

            overview = row["overview"].strip()
            tagline = (row.get("tagline") or "").strip()
            genres = (
                normalize_genres(j_match.get("genres"))
                if j_match
                else infer_genres_from_text(title, overview, tagline)
            )
            if not genres:
                genres = infer_genres_from_text(title, overview, tagline)

            directors = (
                [d.strip() for d in str(j_match.get("directors") or "").split(",") if d.strip()][:3]
                if j_match
                else []
            )
            cast = (
                [c.strip() for c in str(j_match.get("cast") or "").split(",") if c.strip()][:6]
                if j_match and j_match.get("cast")
                else imdb_cast
            )
            try:
                imdb_val = round(min(9.5, max(5.5, float(row.get("vote_average") or 7.0))), 1)
            except Exception:
                imdb_val = 7.1

            backdrop_url = (
                f"{TMDB_BACKDROP_BASE}{j_match['backdrop_path']}"
                if j_match and j_match.get("backdrop_path")
                else poster_url
            )
            votes = int(row.get("vote_count") or 1200)
            runtime_int = int(float(row.get("runtime") or 110))

            used_slugs.add(slug)
            used_titles_years.add((title.lower(), year))
            collected.append(
                {
                    "title": title,
                    "original_title": (row.get("original_title") or title).strip()[:250],
                    "year": year,
                    "runtime": runtime_int,
                    "genres": genres,
                    "directors": directors,
                    "cast": cast,
                    "overview": overview[:1500],
                    "poster_url": poster_url,
                    "backdrop_url": backdrop_url,
                    "imdb_rating": imdb_val,
                    "votes": votes,
                    "language": (row.get("original_language") or "en").strip(),
                    "source": "tmdb-2021-2026",
                }
            )
            recent_added_by_year[year] += 1

    print("Recent 2021-2026 added by year:", recent_added_by_year)
    print(f"Total NEW expanded movies written: {len(collected)}")
    OUT_PATH.write_text(
        json.dumps({"count": len(collected), "movies": collected}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Saved -> {OUT_PATH} ({OUT_PATH.stat().st_size / 1024 / 1024:.2f} MB)")


if __name__ == "__main__":
    asyncio.run(build_catalog())
