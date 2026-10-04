import logging

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from .config import get_settings
from .routers import chat, data, plan, seed

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

settings = get_settings()

app = FastAPI(
    title="OptiFarm API",
    version="0.1.0",
    description="Vision proxy, grounded chatbot proxy, weather and water model for OptiFarm.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

for r in (data.router, seed.router, plan.router, chat.router):
    app.include_router(r)


@app.exception_handler(Exception)
async def unhandled(_: Request, exc: Exception) -> JSONResponse:
    logging.getLogger("optifarm").exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on the server."})


# In production (single Render service) the built frontend is served from STATIC_DIR, so the
# app and the API share one origin. In local development Vite serves the frontend instead.
if settings.static_dir and settings.static_dir.is_dir():
    static_root = settings.static_dir.resolve()

    @app.get("/{path:path}", include_in_schema=False)
    async def spa(path: str) -> FileResponse:
        if path.startswith("api/"):
            raise HTTPException(404, "Not found")
        candidate = (static_root / path).resolve()
        if path and candidate.is_file() and candidate.is_relative_to(static_root):
            # Hashed build assets never change; the service worker and HTML must revalidate.
            immutable = path.startswith("assets/")
            headers = {"Cache-Control": "public, max-age=31536000, immutable" if immutable else "no-cache"}
            return FileResponse(candidate, headers=headers)
        # Client-side routes (/app/seed, ...) all load the SPA shell.
        return FileResponse(static_root / "index.html", headers={"Cache-Control": "no-cache"})
