from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from ..config import get_settings
from ..models.schemas import SeedIdentifyResponse
from ..ratelimit import ai_rate_limit
from ..services.ai import AIRefused, AIUnavailable
from ..services.vision import identify_seed

router = APIRouter(prefix="/api/seed", tags=["seed"])

ALLOWED = {"image/jpeg", "image/png", "image/webp", "image/gif"}


@router.post("/identify", response_model=SeedIdentifyResponse, dependencies=[Depends(ai_rate_limit)])
async def identify(image: UploadFile = File(...)) -> SeedIdentifyResponse:
    """Identify a seed photo. The image is processed in memory and never stored."""
    if image.content_type not in ALLOWED:
        raise HTTPException(415, "Please upload a JPEG, PNG, WebP or GIF photo.")
    max_bytes = int(get_settings().max_image_mb * 1024 * 1024)
    data = await image.read(max_bytes + 1)
    await image.close()
    if len(data) > max_bytes:
        raise HTTPException(413, "Photo is too large.")
    if not data:
        raise HTTPException(400, "Empty upload.")
    try:
        matches = await identify_seed(data, image.content_type)
    except AIRefused:
        matches = []
    except AIUnavailable as e:
        raise HTTPException(503, f"Seed identification is unavailable right now ({e}). Pick the crop manually.") from e
    finally:
        del data  # nothing is persisted
    return SeedIdentifyResponse(top_matches=matches)
