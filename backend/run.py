"""
Convenience entrypoint script to launch the FastAPI server.
"""
import os
import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    reload = "PORT" not in os.environ
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=reload)
