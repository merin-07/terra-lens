
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="TERRA-LENS API",
    description="Planetary Analog Discovery Workbench"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {
        "message": "TERRA-LENS API is running!",
        "status": "online"
    }

@app.get("/health")
def health():
    return {"status": "healthy"}
