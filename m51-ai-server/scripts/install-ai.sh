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
if [[ ! -d "$ROOT/llama.cpp" ]]; then
    git clone --depth 1 https://github.com/ggml-org/llama.cpp.git "$ROOT/llama.cpp"
fi
[[ "$(git -C "$ROOT/llama.cpp" remote get-url origin)" == https://github.com/ggml-org/llama.cpp.git ]] || exit 13
git -C "$ROOT/llama.cpp" diff --quiet || { echo 'Source has local modifications; inspect first'; exit 14; }
git -C "$ROOT/llama.cpp" rev-parse HEAD | tee "$ROOT/docs/llama-commit.txt"
cmake -S "$ROOT/llama.cpp" -B "$ROOT/llama.cpp/build" \
    -DCMAKE_BUILD_TYPE=Release -DGGML_NATIVE=OFF -DGGML_CPU_ARM_ARCH=armv8-a \
    -DGGML_OPENMP=OFF -DGGML_LLAMAFILE=OFF -DGGML_VULKAN=OFF -DGGML_CUDA=OFF \
    -DLLAMA_OPENSSL=OFF -DLLAMA_CURL=OFF -DLLAMA_BUILD_TESTS=OFF \
    -DLLAMA_BUILD_SERVER=ON -DLLAMA_BUILD_EXAMPLES=OFF
cmake --build "$ROOT/llama.cpp/build" --target llama-server --parallel 2
"$ROOT/llama.cpp/build/bin/llama-server" --version
python "$ROOT/scripts/download-model.py"
[[ -f "$ROOT/config/server.env" ]] || cp "$ROOT/config/server.env.example" "$ROOT/config/server.env"
python "$ROOT/scripts/manage-ai.py" setup
echo 'PASS: install complete; run scripts/start-ai.sh'
