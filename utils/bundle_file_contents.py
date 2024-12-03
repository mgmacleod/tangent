import os
import glob
from pathlib import Path

def should_ignore_path(path, ignore_paths):
    """Check if path should be ignored based on ignore list."""
    path = str(Path(path).absolute())
    return any(ignore_path in path for ignore_path in ignore_paths)

def find_files(directory, ignore_paths):
    """Find all .js, .jsx, and .py files recursively, excluding ignored paths."""
    js_files = []
    py_files = []
    
    for ext in ['**/*.js', '**/*.jsx', '**/*.py']:
        pattern = os.path.join(directory, ext)
        files = glob.glob(pattern, recursive=True)
        
        for file in files:
            if not should_ignore_path(file, ignore_paths):
                if file.endswith(('.js', '.jsx')):
                    js_files.append(file)
                elif file.endswith('.py'):
                    py_files.append(file)
    
    return sorted(js_files), sorted(py_files)

def bundle_files(output_file, files, file_type):
    """Bundle files with delimiters into the output file."""
    with open(output_file, 'a', encoding='utf-8') as out:
        out.write(f"\n{'='*80}\n")
        out.write(f"BEGIN {file_type.upper()} FILES\n")
        out.write(f"{'='*80}\n\n")
        
        for file in files:
            try:
                with open(file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                relative_path = os.path.relpath(file)
                delimiter = f"\n{'#' if file.endswith('.py') else '//'} {'='*40}\n"
                delimiter += f"{'#' if file.endswith('.py') else '//'} File: {relative_path}\n"
                delimiter += f"{'#' if file.endswith('.py') else '//'} {'='*40}\n\n"
                
                out.write(delimiter)
                out.write(content)
                out.write('\n\n')
            except Exception as e:
                print(f"Error processing {file}: {str(e)}")

def main():
    # Get the absolute path of the current script
    current_script = str(Path(__file__).absolute())
    
    # Base directory (modify this to your needs)
    base_dir = "."
    
    # Paths to ignore
    ignore_paths = [
        "/Users/928546/Desktop/simplified/simplified-ab/simplified_env",
        "/Users/928546/Desktop/simplified/simplified-ab/ollama_continue.py",
        "/Users/928546/Desktop/simplified/simplified-ui/node_modules",
        "/Users/928546/Desktop/simplified/simplified-ui/src/App.test.js",
        "/Users/928546/Desktop/simplified/simplified-ui/src/reportWebVitals.js",
        "/Users/928546/Desktop/simplified/simplified-ui/src/setupTests.js",
        "/Users/928546/Desktop/simplified/simplified-ui/postcss.config.js",
        "/Users/928546/Desktop/simplified/simplified-ui/tailwind.config.js",
        current_script,  # Add the current script to ignore paths
    ]
    
    # Output file
    output_file = "bundled_code.txt"
    ignore_paths.append(str(Path(output_file).absolute()))  # Also ignore the output file
    
    # Remove existing output file if it exists
    if os.path.exists(output_file):
        os.remove(output_file)
    
    # Find and bundle files
    js_files, py_files = find_files(base_dir, ignore_paths)
    
    print(f"Found {len(js_files)} JavaScript/JSX files and {len(py_files)} Python files")
    
    # Bundle JavaScript/JSX files
    if js_files:
        bundle_files(output_file, js_files, "JavaScript/JSX")
    
    # Bundle Python files
    if py_files:
        bundle_files(output_file, py_files, "Python")
    
    print(f"Files have been bundled into {output_file}")

if __name__ == "__main__":
    main()