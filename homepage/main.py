from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi import Request
from pathlib import Path

app = FastAPI()

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
