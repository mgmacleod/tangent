from flask import Blueprint, jsonify, request
import os
import json
from datetime import datetime
from config import BASE_DATA_DIR

chats_bp = Blueprint("chats", __name__)


@chats_bp.route("/api/chats/save", methods=["POST"])
def save_chat():
    try:
        data = request.json
        chat_id = data.get("chatId", str(datetime.now().timestamp()))
        chat_data = {
            "id": chat_id,
            "nodes": data.get("nodes", []),
            "lastModified": datetime.now().isoformat(),
            "title": data.get("title", "Untitled Chat"),
            "metadata": data.get("metadata", {}),
        }
        # Create chats directory if it doesn't exist
        chats_dir = os.path.join(BASE_DATA_DIR, "chats")
        os.makedirs(chats_dir, exist_ok=True)
        # Save chat data
        chat_file = os.path.join(chats_dir, f"{chat_id}.json")
        with open(chat_file, "w") as f:
            json.dump(chat_data, f)
        return jsonify(
            {"success": True, "chatId": chat_id, "message": "Chat saved successfully"}
        )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@chats_bp.route("/api/chats/load/<chat_id>", methods=["GET"])
def load_chat(chat_id):
    try:
        chat_file = os.path.join(BASE_DATA_DIR, "chats", f"{chat_id}.json")
        if not os.path.exists(chat_file):
            return jsonify({"success": False, "error": "Chat not found"}), 404
        with open(chat_file, "r") as f:
            chat_data = json.load(f)
        return jsonify({"success": True, "data": chat_data})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@chats_bp.route("/api/chats/list", methods=["GET"])
def list_chats():
    try:
        chats_dir = os.path.join(BASE_DATA_DIR, "chats")
        os.makedirs(chats_dir, exist_ok=True)
        chats = []
        for filename in os.listdir(chats_dir):
            if filename.endswith(".json"):
                with open(os.path.join(chats_dir, filename), "r") as f:
                    chat_data = json.load(f)
                chats.append(
                    {
                        "id": chat_data["id"],
                        "title": chat_data.get("title", "Untitled Chat"),
                        "lastModified": chat_data.get("lastModified"),
                        "metadata": chat_data.get("metadata", {}),
                    }
                )
        return jsonify(
            {
                "success": True,
                "chats": sorted(chats, key=lambda x: x["lastModified"], reverse=True),
            }
        )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@chats_bp.route("/api/chats/delete/<chat_id>", methods=["DELETE"])
def delete_chat(chat_id):
    try:
        chat_file = os.path.join(BASE_DATA_DIR, "chats", f"{chat_id}.json")
        if not os.path.exists(chat_file):
            return jsonify({"success": False, "error": "Chat not found"}), 404
        os.remove(chat_file)
        return jsonify({"success": True, "message": "Chat deleted successfully"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
