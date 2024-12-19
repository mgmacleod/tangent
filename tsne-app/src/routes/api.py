from pathlib import Path
from flask import Blueprint, request, jsonify
from services.reflection import get_reflections
from services.topic_generation import get_topics
from services.embedding import get_embeddings
from services.background_processor import BackgroundProcessor

api_bp = Blueprint("api", __name__)
background_processor = BackgroundProcessor()


@api_bp.route("/process", methods=["POST"])
def process_data():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files["file"]
        if not file.filename.endswith(".json"):
            return jsonify({"error": "Invalid file type"}), 400

        # Save uploaded file
        data_dir = Path("./unprocessed")
        data_dir.mkdir(exist_ok=True)
        file_path = data_dir / "chat_data.json"
        file.save(file_path)

        # Start background processing
        task_id = background_processor.start_task(str(file_path))

        return jsonify({"task_id": task_id, "message": "Processing started"}), 202

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@api_bp.route("/process/status/<task_id>", methods=["GET"])
def check_task_status(task_id):
    status = background_processor.get_task_status(task_id)
    if status:
        return jsonify(
            {
                "status": status.status,
                "progress": status.progress,
                "error": status.error,
                "completed": status.completed,
            }
        ), 200
    return jsonify({"error": "Task not found"}), 404


@api_bp.route("/get-reflections", methods=["POST"])
def reflections():
    data = request.json
    reflections = get_reflections(data)
    return jsonify(reflections), 200


@api_bp.route("/topics", methods=["GET"])
def topics():
    topics_data = get_topics()
    return jsonify(topics_data), 200


@api_bp.route("/embeddings", methods=["POST"])
def embeddings():
    data = request.json
    texts = data.get("texts", [])
    embeddings = get_embeddings(texts)
    return jsonify({"embeddings": embeddings}), 200


def register_routes(app):
    app.register_blueprint(api_bp, url_prefix="/api")
