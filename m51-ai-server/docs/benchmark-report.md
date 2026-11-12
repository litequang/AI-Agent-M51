# Benchmark report

Generated: 2026-11-12T20:45:03.629040+07:00

CPU only, context 2048, threads 4, batch/ubatch 128, one slot, idle polling disabled. Chat defaults to non-thinking; the structured extraction retest can override thinking per request, as recorded in summary-results.json.

- Measured generation tokens/s: 4.09 to 6.14, median 5.99.
- Idle CPU: 0.0% of one core over 20.001597388996743 seconds.
- Idle RSS: 1367796 KiB.
- Soak RSS range: 31.1 to 1531.1 MiB.
- Soak battery temperature range: 27.6 to 30.4 C.
- Crash recovery: 2.0307147389976308 seconds.
- Soak: PASS, 1800.0 seconds, 115 samples, 0 recorded failures.

Generation rates come from llama.cpp's reported predicted_per_second, excluding prompt processing. End-to-end rates and wall times are recorded separately in JSON files. Short arithmetic requests benefit from prompt caching; the longer summary response is more representative of the requested workflow.

- Vietnamese: 4.76 seconds, 11 completion tokens, 2.31 end-to-end tokens/s.
- Structured summary: 117.71 seconds, 361 completion tokens, 3.07 end-to-end tokens/s.
