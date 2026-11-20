from __future__ import annotations

import asyncio
import csv
import hashlib
import random
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from bson import ObjectId
from pymongo import UpdateOne

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import get_settings
from app.core.database import mongo_manager
from app.core.sanitize import slugify
from app.core.security import hash_password
from app.db.schemas import ensure_collections_and_indexes

DATASET_PATH = BACKEND_DIR / "data" / "imdb_top_1000.csv"
EXTRA_DATASET_PATH = BACKEND_DIR / "data" / "extra_imdb_movies.json"
POSTER_OVERRIDES_PATH = BACKEND_DIR / "data" / "poster_overrides.json"

# Real YouTube trailer video IDs for iconic films in the IMDb catalog
CURATED_TRAILERS_BY_TITLE: dict[str, str] = {
    "the shawshank redemption": "PLl99DlL6b4",
    "the godfather": "UaVTIH8mujA",
    "the dark knight": "EXeTwQWrcwY",
    "the godfather: part ii": "9O1Iy9od7-A",
    "12 angry men": "TEN-2uTi2c0",
    "the lord of the rings: the return of the king": "r5X-hFf6Bwo",
    "pulp fiction": "s7EdQ4FqbhY",
    "schindler's list": "gG22XNhtnoY",
    "inception": "YoHD9XEInc0",
    "fight club": "qtRKdVHc-cE",
    "the lord of the rings: the fellowship of the ring": "V75dMMIW2B4",
    "forrest gump": "bLvqoHBptjg",
    "il buono, il brutto, il cattivo": "IFNUGzCOQoI",
    "the lord of the rings: the two towers": "LbfMDwc4azU",
    "the matrix": "vKQi3bBA1y8",
    "goodfellas": "2ilzidi_J8Q",
    "star wars: episode v - the empire strikes back": "JNwNXF9Y6kY",
    "one flew over the cuckoo's nest": "OXrcDonY-B8",
    "hamilton": "DSCKfXpAGHc",
    "gisaengchung": "5xH0HfJHsaY",
    "soorarai pottru": "fa_DIwRsa9o",
    "interstellar": "zSWdZVtXT7E",
    "cidade de deus": "dcUOO4Itgmw",
    "sen to chihiro no kamikakushi": "ByXuk9QqQkk",
    "saving private ryan": "9CiW_DgxCnQ",
    "the green mile": "Ki4haFrqSrw",
    "la vita è bella": "pAYEQP8gx3w",
    "se7en": "znmZoVkCjpI",
    "the silence of the lambs": "6iB21hsprAQ",
    "star wars": "vZ734NWnAHA",
    "seppuku": "gfABwM-Ppng",
    "shichinin no samurai": "wJ1TOratCTo",
    "it's a wonderful life": "iLR3gZrU2Xo",
    "joker": "zAGVQLHvwOY",
    "whiplash": "7d_jQycdQGo",
    "the intouchables": "34WIbmXkewU",
    "the prestige": "RLtaA9fFNXU",
    "the departed": "iojhqm0JTW4",
    "the pianist": "BFwGqLa_oAo",
    "gladiator": "P5ieIbInFpg",
    "american history x": "XfQYHqsiN5g",
    "the usual suspects": "oiXdPolca5w",
    "léon": "aNQqoExfQsg",
    "the lion king": "lFzVJEksoDY",
    "terminator 2: judgment day": "CRRlbK5w8AE",
    "cinema paradiso": "JMyVSD6OvO8",
    "hotaru no haka": "4vPeTSRd580",
    "back to the future": "qvsgGtivCgs",
    "once upon a time in the west": "c8CJ6L0I6W8",
    "psycho": "Wz719b9QUqY",
    "casablanca": "BkL9l7qovsE",
    "modern times": "GLeDdzGUTq0",
    "city lights": "7vl7F8S4cpQ",
    "capharnaüm": "ULUo0048xZE",
    "kimi no na wa.": "xU47nhruN-Q",
    "spider-man: into the spider-verse": "g4Hbz2jLxvQ",
    "avengers: endgame": "TcMBFSGVi1c",
    "avengers: infinity war": "6ZfuNTqbHE8",
    "coco": "Rvr68u6k5sI",
    "django unchained": "0fUCuvNlOCg",
    "the dark knight rises": "g8evyE9TuYk",
    "3 idiots": "K0eDlFX9GMc",
    "wall·e": "CZ1CATNbXg0",
    "the lives of others": "n3_iLOp6IhM",
    "oldboy": "2HkjrJ6IK5E",
    "memento": "4CV41hoyS8A",
    "mononoke-hime": "4OiMOHRDs14",
    "once upon a time in america": "L0CRn573s7k",
    "raiders of the lost ark": "0xQSIdSRlAk",
    "the shining": "S014oGZiSdI",
    "apocalypse now": "9l-ViOOFH-s",
    "alien": "LjLamj-b0I8",
    "inglourious basterds": "KnrRy6kSFF0",
    "good will hunting": "PaZVjZEFkRs",
    "rashômon": "xCZ9TguVOIA",
    "dancer in the dark": "53vr9EiOH7g",
    "bãhubali: the beginning": "sOEg_YZQsTI",
    "talvar": "aQNMsw8Ljjc",
    "miracle on 34th street": "lo5Om6z2H4Q",
    "festen": "vKe8bf6769c",
}

FALLBACK_TRAILER_IDS: list[str] = [
    "PLl99DlL6b4", "UaVTIH8mujA", "EXeTwQWrcwY", "YoHD9XEInc0", "zSWdZVtXT7E",
    "5xH0HfJHsaY", "ByXuk9QqQkk", "7d_jQycdQGo", "s7EdQ4FqbhY", "RLtaA9fFNXU",
    "GLeDdzGUTq0", "PaZVjZEFkRs", "xCZ9TguVOIA", "L0CRn573s7k", "BkL9l7qovsE",
]


def resolve_trailer_url(title: str, idx: int) -> str:
    vid = CURATED_TRAILERS_BY_TITLE.get(title.strip().lower())
    if not vid:
        vid = FALLBACK_TRAILER_IDS[idx % len(FALLBACK_TRAILER_IDS)]
    return f"https://www.youtube.com/watch?v={vid}"

# 8 Cinema Personas so TV2's Collaborative Filtering & Content-Based recommendations
# discover realistic, coherent taste clusters instead of white noise.
PERSONAS: list[dict[str, Any]] = [
    {
        "name": "Sci-Fi & Mind-Bender",
        "genres": ["Sci-Fi", "Thriller", "Mystery", "Action"],
        "comments_high": [
            "Cấu trúc kịch bản xuất sắc, càng xem lại càng thấy nhiều lớp ý nghĩa tinh tế.",
            "Hình ảnh và âm thanh tạo bầu không khí nghẹt thở từ đầu tới cuối.",
            "Một kiệt tác thị giác và ý tưởng, đáng nằm trong danh sách phim phải xem.",
            "Nhịp phim chặt chẽ, cú twist cuối cùng cực kỳ thỏa mãn.",
        ],
        "comments_low": [
            "Nhịp phim hơi chậm ở nửa đầu, chưa tạo đủ cao trào như kỳ vọng.",
            "Ý tưởng ổn nhưng cách triển khai còn khá dài dòng.",
        ],
    },
    {
        "name": "Crime & Neo-Noir",
        "genres": ["Crime", "Drama", "Thriller", "Film-Noir"],
        "comments_high": [
            "Diễn xuất đỉnh cao, từng câu thoại đều có sức nặng và chiều sâu tâm lý.",
            "Không khí đen tối chân thực, góc quay đậm chất điện ảnh cổ điển.",
            "Xây dựng nhân vật phản diện và xung đột đạo đức quá xuất sắc.",
            "Mỗi phân cảnh đối thoại đều căng như dây đàn, xem không thể rời mắt.",
        ],
        "comments_low": [
            "Mạch truyện hơi nặng nề và dễ đoán ở hồi kết.",
            "Nhân vật phụ chưa có đủ đất diễn để tạo điểm nhấn.",
        ],
    },
    {
        "name": "Animation & Fantasy",
        "genres": ["Animation", "Fantasy", "Adventure", "Family"],
        "comments_high": [
            "Thế giới hình ảnh giàu trí tưởng tượng, xem xong vẫn thấy ấm áp và bồi hồi.",
            "Phần nhạc phim hòa quyện hoàn hảo với từng khung hình nghệ thuật.",
            "Không chỉ dành cho thiếu nhi, tầng ý nghĩa về trưởng thành rất chạm cảm xúc.",
            "Hoạt họa tinh xảo, biểu cảm nhân vật sống động đến từng chi tiết nhỏ.",
        ],
        "comments_low": [
            "Hình ảnh đẹp nhưng cốt truyện có phần an toàn và quen thuộc.",
            "Hài hước nhẹ nhàng nhưng thiếu điểm bùng nổ cảm xúc.",
        ],
    },
    {
        "name": "Prestige Drama & Biography",
        "genres": ["Drama", "Biography", "History"],
        "comments_high": [
            "Một tác phẩm giàu nhân văn, lắng đọng rất lâu sau khi credit chạy hết.",
            "Tái hiện bối cảnh lịch sử công phu, diễn viên hóa thân thuyết phục tuyệt đối.",
            "Biên kịch tiết chế cảm xúc rất khéo, không hề bị sến hay lên gân.",
            "Ánh sáng và bố cục khung hình chuẩn mực điện ảnh nghệ thuật.",
        ],
        "comments_low": [
            "Thời lượng hơi dài so với lượng sự kiện trong phim.",
            "Không khí khá trầm, kén người xem nếu muốn giải trí nhẹ.",
        ],
    },
    {
        "name": "Action & Epic Adventure",
        "genres": ["Action", "Adventure", "Sci-Fi", "Western"],
        "comments_high": [
            "Trường đoạn hành động dàn dựng mãn nhãn, quay thực chiến đầy uy lực.",
            "Quy mô đại cảnh choáng ngợp, xem trên màn hình lớn cực kỳ đã mắt.",
            "Tiết tấu cuốn hút từ phút đầu tiên, không có cảnh thừa.",
            "Âm thanh cháy nổ và thiết kế bối cảnh đạt đẳng cấp bom tấn đích thực.",
        ],
        "comments_low": [
            "Hành động ổn nhưng phần phát triển nhân vật hơi mỏng.",
            "Một vài tình tiết phi lý nhẹ nhưng vẫn xem giải trí được.",
        ],
    },
    {
        "name": "Comedy & Romance",
        "genres": ["Comedy", "Romance", "Music", "Musical"],
        "comments_high": [
            "Duyên dáng, thông minh và đầy năng lượng tích cực, xem đi xem lại không chán.",
            "Phản ứng hóa học giữa hai diễn viên chính quá tự nhiên và đáng yêu.",
            "Lời thoại hóm hỉnh, lồng ghép khéo léo những khoảng lặng rất đời.",
            "Giai điệu bắt tai cùng bảng màu rực rỡ khiến tâm trạng tốt hẳn lên.",
        ],
        "comments_low": [
            "Một vài mảng miếng hài hơi cũ, nhịp ở giữa hơi chùng xuống.",
            "Dễ thương nhưng kết phim đi theo lối mòn quen thuộc.",
        ],
    },
    {
        "name": "Horror & Psychological Mystery",
        "genres": ["Horror", "Mystery", "Thriller"],
        "comments_high": [
            "Không lạm dụng jumpscare mà vẫn khiến người xem lạnh sống lưng vì bầu không khí.",
            "Cách gieo manh mối tinh vi, càng gần cuối càng hồi hộp nghẹt thở.",
            "Âm thanh rờn rợn kết hợp diễn xuất ám ảnh tạo trải nghiệm khó quên.",
            "Tâm lý nhân vật chuyển biến tinh tế, giữ sự bất ngờ tới phút chót.",
        ],
        "comments_low": [
            "Không khí tốt nhưng lời giải đáp bí ẩn ở cuối chưa thực sự thuyết phục.",
            "Hơi ít tình tiết căng thẳng so với kỳ vọng thể loại kinh dị.",
        ],
    },
    {
        "name": "War & Historical Classics",
        "genres": ["War", "History", "Drama", "Western"],
        "comments_high": [
            "Góc nhìn chân thực và khốc liệt về chiến tranh, đầy sức nặng lịch sử.",
            "Cảnh quay dài ngoạn mục, lột tả trọn vẹn bi kịch và tình đồng đội.",
            "Một tượng đài điện ảnh vượt thời gian, xem lại vẫn nổi da gà.",
            "Kỹ thuật dựng phim và thiết kế âm thanh chiến trường quá ấn tượng.",
        ],
        "comments_low": [
            "Bối cảnh đầu tư lớn nhưng tuyến nhân vật hơi dàn trải.",
            "Nửa đầu thiết lập khá lâu trước khi bước vào cao trào.",
        ],
    },
]

VIET_LAST_NAMES = [
    "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ", "Đặng",
    "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý", "Trương", "Đinh", "Đoàn", "Mai",
]
VIET_MIDDLE_NAMES = [
    "Minh", "Quốc", "Gia", "Thanh", "Ngọc", "Phương", "Hoài", "Tuấn", "Anh", "Khánh",
    "Thảo", "Đức", "Hải", "Nhật", "Bảo", "Lan", "Tường", "Hữu", "Xuân", "Thùy",
]
VIET_FIRST_NAMES = [
    "Anh", "Bảo", "Chi", "Dũng", "Duy", "Giang", "Hà", "Hân", "Hiếu", "Huy",
    "Khang", "Khoa", "Lâm", "Linh", "Long", "My", "Nam", "Nga", "Nhi", "Phong",
    "Phúc", "Quân", "Quỳnh", "Sơn", "Tâm", "Thảo", "Thịnh", "Trang", "Trí", "Tú",
    "Tùng", "Uyên", "Vân", "Việt", "Vy", "Yến",
]


def deterministic_oid(namespace: str, key: str) -> ObjectId:
    digest = hashlib.md5(f"{namespace}:{key}".encode("utf-8")).hexdigest()
    return ObjectId(digest[:24])


def upgrade_imdb_poster(url: str) -> str | None:
    cleaned = (url or "").strip()
    if not cleaned:
        return None
    # Convert 67x98 IMDb thumbnail URL to crisp 420px portrait poster URL
    return re.sub(r"\._V1_.*\.jpg$", "._V1_QL80_UX420_.jpg", cleaned)


def parse_runtime(raw: str) -> int:
    match = re.search(r"(\d+)", raw or "")
    val = int(match.group(1)) if match else 110
    return max(1, min(val, 1000))


def parse_int_or_none(raw: str) -> int | None:
    cleaned = (raw or "").strip().replace(",", "")
    if cleaned.isdigit():
        return int(cleaned)
    return None


def parse_float_or_none(raw: str) -> float | None:
    try:
        return float((raw or "").strip())
    except ValueError:
        return None


def load_real_movies(limit: int) -> list[dict[str, Any]]:
    if not DATASET_PATH.exists():
        raise FileNotFoundError(f"Real movie dataset not found at {DATASET_PATH}")

    import json

    poster_overrides: dict[str, str] = {}
    if POSTER_OVERRIDES_PATH.exists():
        try:
            poster_overrides = json.loads(POSTER_OVERRIDES_PATH.read_text(encoding="utf-8"))
        except Exception:
            poster_overrides = {}

    movies: list[dict[str, Any]] = []
    used_slugs: set[str] = set()
    base_time = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

    with DATASET_PATH.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader):
            if len(movies) >= limit:
                break
            title = (row.get("Series_Title") or "").strip()
            year_raw = (row.get("Released_Year") or "").strip()
            if not title:
                continue
            year = int(year_raw) if year_raw.isdigit() else 1995
            if not (1888 <= year <= 2100):
                continue

            genres = [g.strip() for g in (row.get("Genre") or "").split(",") if g.strip()]
            if not genres:
                genres = ["Drama"]

            directors = [d.strip() for d in (row.get("Director") or "").split(",") if d.strip()]
            cast = []
            for col in ("Star1", "Star2", "Star3", "Star4"):
                actor = (row.get(col) or "").strip()
                if actor and actor not in cast:
                    cast.append(actor)

            slug = slugify(title, year)
            if slug in used_slugs:
                slug = f"{slug}-{idx}"
            used_slugs.add(slug)

            imdb_rating = parse_float_or_none(row.get("IMDB_Rating") or "")
            meta_score = parse_int_or_none(row.get("Meta_score") or "")
            votes = parse_int_or_none(row.get("No_of_Votes") or "") or 10000
            created_at = base_time + timedelta(hours=idx)

            poster = poster_overrides.get(slug) or upgrade_imdb_poster(row.get("Poster_Link") or "")
            movies.append(
                {
                    "_id": deterministic_oid("movie", slug),
                    "slug": slug,
                    "title": title,
                    "original_title": title,
                    "overview": (row.get("Overview") or "").strip() or f"{title} ({year})",
                    "release_year": year,
                    "runtime_minutes": parse_runtime(row.get("Runtime") or ""),
                    "certificate": (row.get("Certificate") or "").strip() or None,
                    "poster_url": poster,
                    "backdrop_url": poster,
                    "trailer_url": resolve_trailer_url(title, idx),
                    "genres": genres,
                    "cast": cast,
                    "directors": directors,
                    "language": "English",
                    "country": "International",
                    "imdb_rating": imdb_rating,
                    "meta_score": meta_score,
                    "avg_rating": 0.0,
                    "rating_count": 0,
                    "views_count": max(120, int(votes / 180)),
                    "is_deleted": False,
                    "deleted_at": None,
                    "created_at": created_at,
                    "updated_at": created_at,
                }
            )

    if EXTRA_DATASET_PATH.exists() and len(movies) < limit:
        extra_raw = json.loads(EXTRA_DATASET_PATH.read_text(encoding="utf-8"))
        for extra_idx, item in enumerate(extra_raw.get("movies", [])):
            if len(movies) >= limit:
                break
            title = (item.get("title") or "").strip()
            year_raw = str(item.get("year") or "").strip()
            if not title or not year_raw.isdigit():
                continue
            year = int(year_raw)
            slug = slugify(title, year)
            if slug in used_slugs:
                continue
            used_slugs.add(slug)

            genres = [g.strip() for g in item.get("genres", []) if isinstance(g, str) and g.strip()] or ["Drama"]
            directors = [d.strip() for d in (item.get("director") or "").split(",") if d.strip() and d.strip() != "N/A"]
            cast = [a.strip() for a in (item.get("actors") or "").split(",") if a.strip()][:6]
            poster = poster_overrides.get(slug) or upgrade_imdb_poster(item.get("posterUrl") or "")
            idx_num = len(movies)
            created_at = base_time + timedelta(hours=idx_num)

            movies.append(
                {
                    "_id": deterministic_oid("movie", slug),
                    "slug": slug,
                    "title": title,
                    "original_title": title,
                    "overview": (item.get("plot") or "").strip() or f"{title} ({year})",
                    "release_year": year,
                    "runtime_minutes": parse_runtime(str(item.get("runtime") or "110")),
                    "certificate": "PG-13",
                    "poster_url": poster,
                    "backdrop_url": poster,
                    "trailer_url": resolve_trailer_url(title, idx_num),
                    "genres": genres,
                    "cast": cast,
                    "directors": directors,
                    "language": "English",
                    "country": "International",
                    "imdb_rating": 7.6,
                    "meta_score": 74,
                    "avg_rating": 0.0,
                    "rating_count": 0,
                    "views_count": 450 + (extra_idx * 17),
                    "is_deleted": False,
                    "deleted_at": None,
                    "created_at": created_at,
                    "updated_at": created_at,
                }
            )
    return movies


def build_users(user_count: int, rng: random.Random) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    """Return list of (user_doc, persona_dict) with deterministic IDs."""
    base_time = datetime(2025, 2, 1, 9, 0, 0, tzinfo=timezone.utc)
    admin_hash = hash_password("Admin@123")
    user_hash = hash_password("User@123")

    fixed_accounts = [
        ("admin@cinevault.local", "Nguyễn Hữu Thành (Admin)", "admin", admin_hash, PERSONAS[0]),
        ("minh.anh@cinevault.local", "Trần Minh Anh", "user", user_hash, PERSONAS[0]),
        ("duc.thinh@cinevault.local", "Lê Đức Thịnh", "user", user_hash, PERSONAS[1]),
        ("linh.chi@cinevault.local", "Phạm Linh Chi", "user", user_hash, PERSONAS[2]),
        ("quoc.bao@cinevault.local", "Hoàng Quốc Bảo", "user", user_hash, PERSONAS[3]),
        ("thao.vy@cinevault.local", "Vũ Thảo Vy", "user", user_hash, PERSONAS[5]),
    ]

    users: list[tuple[dict[str, Any], dict[str, Any]]] = []
    for idx, (email, full_name, role, pw_hash, persona) in enumerate(fixed_accounts):
        ts = base_time + timedelta(hours=idx * 2)
        doc = {
            "_id": deterministic_oid("user", email),
            "email": email,
            "password_hash": pw_hash,
            "full_name": full_name,
            "role": role,
            "is_active": True,
            "avatar_url": None,
            "bio": f"Cinephile — yêu thích thể loại {', '.join(persona['genres'][:3])}.",
            "favorite_genres": list(persona["genres"][:3]),
            "watchlist": [],
            "created_at": ts,
            "updated_at": ts,
        }
        users.append((doc, persona))

    remaining = max(0, user_count - len(fixed_accounts))
    for i in range(1, remaining + 1):
        persona = PERSONAS[i % len(PERSONAS)]
        ln = VIET_LAST_NAMES[(i * 3) % len(VIET_LAST_NAMES)]
        mn = VIET_MIDDLE_NAMES[(i * 7) % len(VIET_MIDDLE_NAMES)]
        fn = VIET_FIRST_NAMES[(i * 11) % len(VIET_FIRST_NAMES)]
        full_name = f"{ln} {mn} {fn}"
        email = f"cinephile.{i:03d}@cinevault.local"
        ts = base_time + timedelta(hours=24 + i * 3)
        # Keep ~3% accounts suspended for realistic Admin Users management demo
        is_active = (i % 35 != 0)
        doc = {
            "_id": deterministic_oid("user", email),
            "email": email,
            "password_hash": user_hash,
            "full_name": full_name,
            "role": "user",
            "is_active": is_active,
            "avatar_url": None,
            "bio": f"Thành viên yêu điện ảnh ({persona['name']}).",
            "favorite_genres": list(persona["genres"][: rng.randint(2, min(3, len(persona["genres"])))]),
            "watchlist": [],
            "created_at": ts,
            "updated_at": ts,
        }
        users.append((doc, persona))

    return users


async def seed_database() -> dict[str, int]:
    settings = get_settings()
    rng = random.Random(20260420)

    db = await mongo_manager.connect()
    try:
        await ensure_collections_and_indexes(db)

        # 1. Seed 600+ real movies (idempotent upsert by unique slug)
        movies = load_real_movies(settings.seed_movie_limit)
        movie_ops = [
            UpdateOne(
                {"slug": m["slug"]},
                {
                    "$set": {
                        "title": m["title"],
                        "original_title": m["original_title"],
                        "overview": m["overview"],
                        "release_year": m["release_year"],
                        "runtime_minutes": m["runtime_minutes"],
                        "certificate": m["certificate"],
                        "poster_url": m["poster_url"],
                        "backdrop_url": m["backdrop_url"],
                        "trailer_url": m["trailer_url"],
                        "genres": m["genres"],
                        "cast": m["cast"],
                        "directors": m["directors"],
                        "language": m["language"],
                        "country": m["country"],
                        "imdb_rating": m["imdb_rating"],
                        "meta_score": m["meta_score"],
                        "updated_at": m["updated_at"],
                    },
                    "$setOnInsert": {
                        "_id": m["_id"],
                        "avg_rating": 0.0,
                        "rating_count": 0,
                        "views_count": m["views_count"],
                        "is_deleted": False,
                        "deleted_at": None,
                        "created_at": m["created_at"],
                    },
                },
                upsert=True,
            )
            for m in movies
        ]
        if movie_ops:
            await db.movies.bulk_write(movie_ops, ordered=False)

        # Resolve canonical movie_ids from MongoDB in case movies existed beforehand
        movie_docs = await db.movies.find(
            {"slug": {"$in": [m["slug"] for m in movies]}},
            {"_id": 1, "slug": 1, "genres": 1, "imdb_rating": 1},
        ).to_list(length=len(movies))

        # Partition movies by genre for persona clustering
        movies_by_genre: dict[str, list[dict[str, Any]]] = {}
        for mdoc in movie_docs:
            for g in mdoc.get("genres", []):
                movies_by_genre.setdefault(g, []).append(mdoc)

        # 2. Seed 220+ users (idempotent upsert by unique email)
        user_pairs = build_users(settings.seed_user_count, rng)

        # Attach deterministic watchlists (4-8 persona movies per user)
        for udoc, persona in user_pairs:
            pool = []
            for g in persona["genres"]:
                pool.extend(movies_by_genre.get(g, []))
            unique_pool = list({m["_id"]: m for m in pool}.values()) or movie_docs
            chosen = rng.sample(unique_pool, k=min(rng.randint(4, 8), len(unique_pool)))
            udoc["watchlist"] = [m["_id"] for m in chosen]

        user_ops = [
            UpdateOne(
                {"email": u["email"]},
                {
                    "$set": {
                        "full_name": u["full_name"],
                        "bio": u["bio"],
                        "favorite_genres": u["favorite_genres"],
                        "updated_at": u["updated_at"],
                    },
                    "$setOnInsert": {
                        "_id": u["_id"],
                        "password_hash": u["password_hash"],
                        "role": u["role"],
                        "is_active": u["is_active"],
                        "avatar_url": u["avatar_url"],
                        "watchlist": u["watchlist"],
                        "created_at": u["created_at"],
                    },
                },
                upsert=True,
            )
            for u, _ in user_pairs
        ]
        if user_ops:
            await db.users.bulk_write(user_ops, ordered=False)

        # 3. Seed 6,000+ persona-clustered reviews + 4,500+ interactions (100% idempotent)
        per_user_reviews = max(25, (settings.seed_review_target // len(user_pairs)) + 1)
        review_ops: list[UpdateOne] = []
        interaction_ops: list[UpdateOne] = []
        review_start = datetime(2025, 3, 1, 8, 0, 0, tzinfo=timezone.utc)

        for u_idx, (udoc, persona) in enumerate(user_pairs):
            uid = udoc["_id"]
            persona_genres = set(persona["genres"])
            in_cluster = [m for m in movie_docs if persona_genres.intersection(m.get("genres", []))]
            out_cluster = [m for m in movie_docs if not persona_genres.intersection(m.get("genres", []))]

            n_in = min(int(per_user_reviews * 0.72), len(in_cluster))
            n_out = min(per_user_reviews - n_in, len(out_cluster))

            selected_in = rng.sample(in_cluster, k=n_in) if n_in > 0 else []
            selected_out = rng.sample(out_cluster, k=n_out) if n_out > 0 else []
            selected = [(m, True) for m in selected_in] + [(m, False) for m in selected_out]

            for m_idx, (mdoc, matches_persona) in enumerate(selected):
                mid = mdoc["_id"]
                if matches_persona:
                    # High affinity: mostly 4-5 stars
                    rating = rng.choices([5, 4, 3], weights=[58, 34, 8], k=1)[0]
                    comment = rng.choice(persona["comments_high"])
                else:
                    # Mixed/lower affinity outside persona
                    rating = rng.choices([4, 3, 2, 1], weights=[22, 42, 24, 12], k=1)[0]
                    comment = (
                        rng.choice(persona["comments_high"])
                        if rating >= 4
                        else rng.choice(persona["comments_low"])
                    )

                ts = review_start + timedelta(minutes=(u_idx * 97 + m_idx * 31) % (365 * 24 * 60))
                rev_id = deterministic_oid("review", f"{uid}:{mid}")
                is_hidden = ((u_idx * 31 + m_idx) % 197 == 0)  # ~0.5% hidden for moderation UI

                review_ops.append(
                    UpdateOne(
                        {"user_id": uid, "movie_id": mid},
                        {
                            "$setOnInsert": {
                                "_id": rev_id,
                                "user_id": uid,
                                "movie_id": mid,
                                "rating": int(rating),
                                "comment": comment,
                                "is_hidden": is_hidden,
                                "created_at": ts,
                                "updated_at": ts,
                            }
                        },
                        upsert=True,
                    )
                )

                # Create matching WATCH interaction + LIKE for 5-star films
                watch_id = deterministic_oid("interaction", f"WATCH:{uid}:{mid}")
                interaction_ops.append(
                    UpdateOne(
                        {"_id": watch_id},
                        {
                            "$setOnInsert": {
                                "_id": watch_id,
                                "user_id": uid,
                                "movie_id": mid,
                                "type": "WATCH",
                                "duration_sec": rng.randint(3600, 9600),
                                "created_at": ts - timedelta(minutes=15),
                            }
                        },
                        upsert=True,
                    )
                )
                if rating == 5:
                    like_id = deterministic_oid("interaction", f"LIKE:{uid}:{mid}")
                    interaction_ops.append(
                        UpdateOne(
                            {"_id": like_id},
                            {
                                "$setOnInsert": {
                                    "_id": like_id,
                                    "user_id": uid,
                                    "movie_id": mid,
                                    "type": "LIKE",
                                    "duration_sec": 0,
                                    "created_at": ts,
                                }
                            },
                            upsert=True,
                        )
                    )

        # Write in chunks for optimal MongoDB batch performance
        chunk_size = 1000
        for i in range(0, len(review_ops), chunk_size):
            await db.reviews.bulk_write(review_ops[i : i + chunk_size], ordered=False)
        for i in range(0, len(interaction_ops), chunk_size):
            await db.interactions.bulk_write(interaction_ops[i : i + chunk_size], ordered=False)

        # 4. Recalculate avg_rating & rating_count on all movies via MongoDB Aggregation
        agg_pipeline = [
            {"$match": {"is_hidden": False}},
            {
                "$group": {
                    "_id": "$movie_id",
                    "avg_rating": {"$avg": "$rating"},
                    "rating_count": {"$sum": 1},
                }
            },
        ]
        cursor = await db.reviews.aggregate(agg_pipeline)
        rating_rows = await cursor.to_list(length=None)
        stat_ops = [
            UpdateOne(
                {"_id": row["_id"]},
                {
                    "$set": {
                        "avg_rating": round(float(row["avg_rating"]), 2),
                        "rating_count": int(row["rating_count"]),
                    }
                },
            )
            for row in rating_rows
        ]
        if stat_ops:
            await db.movies.bulk_write(stat_ops, ordered=False)

        counts = {
            "movies": await db.movies.count_documents({}),
            "users": await db.users.count_documents({}),
            "reviews": await db.reviews.count_documents({}),
            "interactions": await db.interactions.count_documents({}),
            "sync_jobs": await db.sync_jobs.count_documents({}),
        }
        return counts
    finally:
        await mongo_manager.close()


async def main() -> None:
    counts = await seed_database()
    print("MongoDB seed completed (idempotent):")
    for k, v in counts.items():
        print(f"  - {k}: {v:,}")
    print("\nDemo credentials:")
    print("  Admin: admin@cinevault.local / Admin@123")
    print("  User : minh.anh@cinevault.local / User@123")


if __name__ == "__main__":
    asyncio.run(main())
