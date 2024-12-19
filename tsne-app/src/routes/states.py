from flask import Blueprint, jsonify, request
import os
import json
from config import CLAUDE_DATA_DIR, CHATGPT_DATA_DIR

states_bp = Blueprint("states", __name__)


@states_bp.route("/api/states", methods=["GET"])
def get_available_states():
    try:
        chat_type = request.args.get("type", "claude")
        data_dir = CLAUDE_DATA_DIR if chat_type == "claude" else CHATGPT_DATA_DIR

        state_dir = os.path.join(data_dir, "states")
        if not os.path.exists(state_dir):
            return jsonify({"states": []})

        states = []
        for file in os.listdir(state_dir):
            if file.startswith("state_") and file.endswith(".json"):
                with open(os.path.join(state_dir, file), "r") as f:
                    state_data = json.load(f)
                    states.append(
                        {
                            "month_year": state_data["month_year"],
                            "total_conversations": state_data["total_conversations"],
                        }
                    )

        return jsonify({"states": sorted(states, key=lambda x: x["month_year"])})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@states_bp.route("/api/state/<month_year>", methods=["GET"])
def get_state(month_year):
    try:
        chat_type = request.args.get("type", "claude")
        data_dir = CLAUDE_DATA_DIR if chat_type == "claude" else CHATGPT_DATA_DIR

        state_file = os.path.join(data_dir, "states", f"state_{month_year}.json")
        if not os.path.exists(state_file):
            return jsonify({"error": "State not found"}), 404

        with open(state_file, "r") as f:
            return jsonify(json.load(f))
    except Exception as e:
        return jsonify({"error": str(e)}), 500
