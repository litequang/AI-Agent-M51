#!/data/data/com.termux/files/usr/bin/bash
set -u
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
bash scripts/start-ai.sh || exit 10
for test in test-api.py test-vietnamese.py test-summary.py test-recovery.py test-idle.py test-lifecycle.py test-security.py; do
    echo "TEST_BEGIN $test $(date -Iseconds)"
    python "tests/$test"
    echo "TEST_EXIT $test $? $(date -Iseconds)"
done
python tests/test-stability.py --minutes 30
result=$?
echo "VALIDATION_COMPLETE soak_exit=$result $(date -Iseconds)"
exit "$result"
