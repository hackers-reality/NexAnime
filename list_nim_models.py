#!/usr/bin/env python3
"""
Script to list all available models on NVIDIA NIM endpoint.
Usage:
    python list_nim_models.py --api-key YOUR_NIM_API_KEY
    or set NIM_API_KEY environment variable.
"""

import argparse
import json
import os
import sys
import requests

def get_models(api_key: str):
    """Fetch model list from NVIDIA NIM endpoint."""
    # Common NVIDIA NIM endpoint for model listing (OpenAI-compatible)
    url = "https://api.nim.nvidia.com/v1/models"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    }
    try:
        resp = requests.get(url, headers=headers, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"Error contacting NIM endpoint: {e}", file=sys.stderr)
        sys.exit(1)
    try:
        data = resp.json()
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON response: {e}", file=sys.stderr)
        sys.exit(1)
    # Expecting a dict with a "data" list of model objects
    models = data.get("data", [])
    if not isinstance(models, list):
        print("Unexpected response format: 'data' field is not a list.", file=sys.stderr)
        sys.exit(1)
    model_names = [m.get("id", "unknown") for m in models]
    return model_names

def main():
    parser = argparse.ArgumentParser(description="List NVIDIA NIM models.")
    parser.add_argument("--api-key", help="NVIDIA NIM API key")
    args = parser.parse_args()
    api_key = args.api_key or os.getenv("NIM_API_KEY")
    if not api_key:
        print("Error: NIM API key required. Provide via --api-key or NIM_API_KEY env var.", file=sys.stderr)
        sys.exit(1)
    model_names = get_models(api_key)
    if not model_names:
        print("No models found.")
    else:
        print("Available models:")
        for name in model_names:
            print(f" - {name}")

if __name__ == "__main__":
    main()