import os
import sys
from pathlib import Path

# Never call the real API from tests, even if a developer's .env has a key.
os.environ["ANTHROPIC_API_KEY"] = ""
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
