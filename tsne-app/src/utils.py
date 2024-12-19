import os
import json

def save_latest_state(update, data_dir):
    with open(os.path.join(data_dir, "embeddings_2d.json"), "w") as f:
        json.dump(update["points"], f)
    with open(os.path.join(data_dir, "clusters.json"), "w") as f:
        json.dump(update["clusters"], f)
    with open(os.path.join(data_dir, "topics.json"), "w") as f:
        json.dump(update["topics"], f)
    with open(os.path.join(data_dir, "chat_titles.json"), "w") as f:
        json.dump(update["titles"], f)

def check_files_exist(data_dir: str) -> dict:
    REQUIRED_FILES = [
        "analytics.json",
        "embeddings_2d.json",
        "clusters.json",
        "topics.json",
        "chat_titles.json",
        "reflections.json",
    ]

    existing_files = {}
    for file in REQUIRED_FILES:
        path = os.path.join(data_dir, file)
        existing_files[file] = os.path.exists(path)
    return existing_files

def send_progress(step, progress=0):
    return f"data: {json.dumps({'type': 'progress', 'step': step, 'progress': progress})}\n\n"

def send_error(message):
    return f"data: {json.dumps({'type': 'error', 'message': message})}\n\n"

def send_complete():
    return f"data: {json.dumps({'type': 'complete'})}\n\n"