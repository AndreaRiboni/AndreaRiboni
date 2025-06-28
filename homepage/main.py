from fastapi import FastAPI, HTTPException, Response
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi import Request
from pathlib import Path
from pymbtiles import MBtiles  #  NEW

app = FastAPI()

MBTILES_PATH = Path(__file__).resolve().parent / "static" / "map.mbtiles"
mb = MBtiles(MBTILES_PATH, mode="r")

@app.on_event("shutdown")
def _close_mb():
    mb.close()

# Set up static directory
static_dir = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Set up templates (assuming HTML files are inside /static)
templates = Jinja2Templates(directory=static_dir)

# Route for '/'
@app.get("/", response_class=HTMLResponse)
async def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# Route for '/terminal'
@app.get("/terminal", response_class=HTMLResponse)
async def read_terminal(request: Request):
    return templates.TemplateResponse("terminal.html", {"request": request})

# Route for '/terminal'
@app.get("/3d", response_class=HTMLResponse)
async def read_terminal(request: Request):
    return templates.TemplateResponse("3dmodel.html", {"request": request})


@app.get("/explorer", response_class=HTMLResponse)
async def read_terminal(request: Request):
    return templates.TemplateResponse("map_index.html", {"request": request})

@app.get("/tiles/{z}/{x}/{y}.png")
async def get_tile(z: int, x: int, y: int):
    """
    Return one PNG tile from static/map.mbtiles.
    Caches for a week (604 800 s).
    """
    try:
        raw = mb.read_tile(z=z, x=x, y=y)

        return Response(
            content=raw,
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=604800, immutable"},
        )

    except Exception:
        # (y is XYZ, so out-of-range or missing → 404)
        raise HTTPException(status_code=404, detail="Tile not found")