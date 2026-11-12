#!/data/data/com.termux/files/usr/bin/bash
set -Eeuo pipefail
umask 077
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
[[ "${PREFIX:-}" == /data/data/com.termux/files/usr && "$(uname -m)" == aarch64 ]] || exit 10
mkdir -p "$ROOT/logs" "$ROOT/models" "$ROOT/run"
exec > >(tee -a "$ROOT/logs/install-$(date +%Y%m%d-%H%M%S).log") 2>&1
trap 'echo "install exit=$?"' EXIT
for tool in git cmake clang make python curl; do command -v "$tool" || { echo "Missing dependency: $tool"; exit 11; }; done
dpkg --audit
curl --version
openssl version
free_kb=$(df -Pk "$ROOT" | awk 'END {print $4}')
((free_kb > 5000000)) || { echo 'Need at least 5 GB free for build/model'; exit 12; }
SOURCE_COMMIT=827466b9efa0574806bad7732bcd78bfb6d9311d
if [[ ! -d "$ROOT/llama.cpp" ]]; then
    git init "$ROOT/llama.cpp"
    git -C "$ROOT/llama.cpp" remote add origin https://github.com/ggml-org/llama.cpp.git
    git -C "$ROOT/llama.cpp" fetch --depth 1 origin "$SOURCE_COMMIT"
    git -C "$ROOT/llama.cpp" checkout --detach FETCH_HEAD
fi
[[ "$(git -C "$ROOT/llama.cpp" remote get-url origin)" == https://github.com/ggml-org/llama.cpp.git ]] || exit 13
[[ "$(git -C "$ROOT/llama.cpp" rev-parse HEAD)" == "$SOURCE_COMMIT" ]] || { echo 'Unexpected source commit; review before rebuilding'; exit 14; }
python "$ROOT/scripts/patch-android-subprocess.py"
git -C "$ROOT/llama.cpp" rev-parse HEAD | tee "$ROOT/docs/llama-commit.txt"
cmake -S "$ROOT/llama.cpp" -B "$ROOT/llama.cpp/build" \
    -DCMAKE_BUILD_TYPE=Release -DGGML_NATIVE=OFF -DGGML_CPU_ARM_ARCH=armv8-a \
    -DGGML_OPENMP=OFF -DGGML_LLAMAFILE=OFF -DGGML_VULKAN=OFF -DGGML_CUDA=OFF \
    -DLLAMA_OPENSSL=OFF -DLLAMA_CURL=OFF -DLLAMA_BUILD_TESTS=OFF \
    -DLLAMA_BUILD_SERVER=ON -DLLAMA_BUILD_EXAMPLES=OFF -DLLAMA_SUBPROCESS=ON
cmake --build "$ROOT/llama.cpp/build" --target llama-server --parallel 2
"$ROOT/llama.cpp/build/bin/llama-server" --version
python "$ROOT/scripts/download-model.py"
python "$ROOT/scripts/download-model.py" qwen3.5-2b
[[ -f "$ROOT/config/server.env" ]] || cp "$ROOT/config/server.env.example" "$ROOT/config/server.env"
python "$ROOT/scripts/manage-ai.py" setup
echo 'PASS: install complete; run scripts/start-ai.sh'
