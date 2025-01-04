import requests
import os

from config import EMBEDDING_MODEL, OLLAMA_HOST


def get_embeddings(texts):
    """Get embeddings from the embedding API"""
    url = f"{OLLAMA_HOST}/api/embed"
    payload = {"model": EMBEDDING_MODEL, "input": texts}
    headers = {"Content-Type": "application/json"}

    try:
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code == 200:
            return response.json().get("embeddings", [])
        else:
            print(f"Error: Received status code {response.status_code}")
            return None
    except Exception as e:
        print(f"Error getting embeddings: {str(e)}")
        return None
