import queue
import threading
import time
import json
import os
from typing import Dict, Optional, Tuple
from models import ProcessingTask
from config import CLAUDE_DATA_DIR, CHATGPT_DATA_DIR
import traceback


class BackgroundProcessor:
    def __init__(self):
        self.tasks: Dict[str, ProcessingTask] = {}
        self.task_queue = queue.Queue()
        self.processing_thread = threading.Thread(
            target=self._process_queue, daemon=True
        )
        self.processing_thread.start()

    def start_task(self, file_path: str) -> str:
        task_id = str(time.time())
        try:
            chat_type, data_dir = detect_chat_type(file_path)
            task = ProcessingTask(
                file_path=file_path,
                status="queued",
                progress=0.0,
                chat_type=chat_type,
                data_dir=data_dir,
            )
            self.tasks[task_id] = task
            self.task_queue.put((task_id, task))
            return task_id
        except Exception as e:
            self.tasks[task_id] = ProcessingTask(
                file_path=file_path, status="error", progress=0.0, error=str(e)
            )
            return task_id

    def get_task_status(self, task_id: str) -> Optional[ProcessingTask]:
        return self.tasks.get(task_id)

    def _process_queue(self):
        while True:
            task_id, task = self.task_queue.get()
            if task_id is None:
                break
            try:
                self.tasks[task_id].status = "processing"
                # Process the task here
                self._process_task(task)
                self.tasks[task_id].status = "completed"
                self.tasks[task_id].completed = True
            except Exception as e:
                self.tasks[task_id].status = "error"
                self.tasks[task_id].error = str(e)
                print(f"Error processing task {task_id}: {str(e)}")
                traceback.print_exc()
            finally:
                self.task_queue.task_done()

    def _process_task(self, task: ProcessingTask):
        # Example processing logic
        try:
            with open(task.file_path, "r") as f:
                data = json.load(f)
            # Simulate processing
            time.sleep(2)
            # Save processed data
            processed_data_dir = os.path.join(task.data_dir, "processed")
            os.makedirs(processed_data_dir, exist_ok=True)
            processed_file_path = os.path.join(
                processed_data_dir, os.path.basename(task.file_path)
            )
            with open(processed_file_path, "w") as f:
                json.dump(data, f)
            task.progress = 100.0
        except Exception as e:
            raise Exception(f"Error processing task: {str(e)}")


def detect_chat_type(file_path: str) -> Tuple[str, str]:
    """
    Detect whether the file contains Claude or ChatGPT chats and return the appropriate data directory
    """
    try:
        with open(file_path, "r") as f:
            data = json.load(f)

        # Check first item in the data
        if isinstance(data, list):
            first_item = data[0] if data else {}

            # ChatGPT format detection (has 'mapping' field)
            if isinstance(first_item, dict) and "mapping" in first_item:
                return "chatgpt", CHATGPT_DATA_DIR
            elif isinstance(first_item, dict) and "chat_messages" in first_item:
                return "claude", CLAUDE_DATA_DIR

        raise ValueError("Unknown chat format")

    except Exception as e:
        raise Exception(f"Error detecting chat type: {str(e)}")
