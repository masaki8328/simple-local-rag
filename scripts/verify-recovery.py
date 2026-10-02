"""Restore old tracked RAG blobs only to a temporary directory, verify Git hashes, then remove it."""
from pathlib import Path
import subprocess
import tempfile

BASELINE = '71809f49637f5a43bd666ef9a17db962d1ad316b'
PATHS = [
    '00-simple-local-rag.ipynb', 'README.md', 'human-nutrition-text.pdf',
    'images/simple-local-rag-workflow-flowchart.png', 'requirements.txt',
    'video_notebooks/.ipynb_checkpoints/00-simple-local-rag-video-checkpoint.ipynb',
    'video_notebooks/00-simple-local-rag-video.ipynb',
]
with tempfile.TemporaryDirectory(prefix='kg-recovery-', dir='/tmp') as directory:
    for index, name in enumerate(PATHS):
        reference = f'{BASELINE}:{name}'
        expected = subprocess.check_output(['git', 'rev-parse', reference], text=True).strip()
        restored = Path(directory) / str(index)
        with restored.open('wb') as output:
            subprocess.run(['git', 'cat-file', 'blob', reference], stdout=output, check=True)
        actual = subprocess.check_output(['git', 'hash-object', str(restored)], text=True).strip()
        assert actual == expected, name
        print(f'PASS: byte-identical recovery: {name}')
print('PASS: all seven RAG files recoverable; temporary restored files removed')
