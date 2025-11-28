# IRIS CLI Scripts

Three command-line tools for invoking Iris evaluation from hooks, scheduled tasks, or manual operations.

## Scripts Overview

### 1. `iris-evaluate.ts` - Single Project Evaluation

Evaluates a single project's health using Iris.

**Usage:**
```bash
npm run iris:evaluate -- --project nfl-predictor
npm run iris:evaluate -- --project microbiome-platform --auto-retrain
npm run iris:evaluate -- -p beclever-ai --output-json report.json --verbose
```

**Arguments:**
- `--project, -p <id>` - Project ID to evaluate (required)
- `--auto-retrain` - Enable auto-retraining for drifting experts
- `--auto-promote` - Enable auto-promotion of better prompts
- `--db-base-path <path>` - Base path for AgentDB databases
- `--log-path <path>` - Path for log files
- `--output-json, -o <file>` - Save report as JSON to file
- `--verbose, -v` - Enable verbose logging
- `--help, -h` - Show help message

**Exit Codes:**
- `0` = Success
- `1` = Error
- `2` = Invalid arguments
- `3` = Project evaluation failed

---

### 2. `iris-evaluate-batch.ts` - Queue-based Batch Evaluation

Reads a queue file (JSONL format), groups events by project, invokes Iris once per project, and clears the queue on successful completion.

**Queue File Format (JSONL):**
```jsonl
{"project": "nfl-predictor", "event": "file_edit", "file": "src/expert.ts", "timestamp": "2024-01-01T00:00:00Z"}
{"project": "microbiome-platform", "event": "model_train", "expertId": "DrDysbiosis", "timestamp": "2024-01-01T01:00:00Z"}
{"project": "beclever-ai", "event": "drift_detected", "timestamp": "2024-01-01T02:00:00Z"}
```

**Usage:**
```bash
npm run iris:evaluate-batch -- --queue .claude/iris-queue.jsonl
npm run iris:evaluate-batch -- -q queue.jsonl --output-dir ./reports
npm run iris:evaluate-batch -- -q queue.jsonl --dry-run --verbose
```

**Arguments:**
- `--queue, -q <file>` - Path to queue file (JSONL format) (required)
- `--clear-on-success` - Clear queue file after successful evaluation (default: true)
- `--no-clear` - Keep queue file after evaluation
- `--db-base-path <path>` - Base path for AgentDB databases
- `--log-path <path>` - Path for log files
- `--output-dir, -o <dir>` - Directory to save evaluation reports
- `--dry-run` - Parse queue but don't run evaluations
- `--verbose, -v` - Enable verbose logging
- `--help, -h` - Show help message

**Exit Codes:**
- `0` = Success
- `1` = Error
- `2` = Invalid arguments
- `3` = Queue processing failed

---

### 3. `iris-auto-invoke.ts` - Smart Invocation with Trigger Checking

Uses intelligent trigger engine to decide if Iris should be invoked based on event type, context, and recent history. Optimized for fast decision-making (<100ms) to be used in hooks.

**Event Types:**
- `file_edit` - File was edited
- `model_train` - Model was trained
- `drift_detected` - Performance drift detected
- `test_failure` - Test failed
- `deployment` - Deployment occurred
- `critical_failure` - Critical failure occurred

**Usage:**
```bash
npm run iris:auto-invoke -- --event file_edit --file src/expert.ts --project nfl-predictor
npm run iris:auto-invoke -- --event model_train --expert TheAnalyst --project nfl-predictor
npm run iris:auto-invoke -- --event drift_detected --project microbiome-platform --force
```

**Arguments:**
- `--event, -e <type>` - Event type (required)
- `--project, -p <id>` - Project ID (required)
- `--file, -f <path>` - File path (for file_edit events)
- `--expert <id>` - Expert ID (for model_train, drift_detected events)
- `--metadata, -m <json>` - Additional metadata as JSON string
- `--db-base-path <path>` - Base path for AgentDB databases
- `--log-path <path>` - Path for log files
- `--force` - Force invocation regardless of triggers
- `--dry-run` - Check triggers but don't invoke
- `--verbose, -v` - Enable verbose logging
- `--help, -h` - Show help message

**Trigger Configuration:**
- **Event Thresholds:**
  - `file_edit`: 10 edits
  - `model_train`: 1 training
  - `drift_detected`: 1 detection (immediate)
  - `test_failure`: 3 failures
  - `deployment`: 1 deployment (immediate)
- **Time Window:** 1 hour
- **Cooldown Period:** 30 minutes
- **Critical Events:** `drift_detected`, `deployment`, `critical_failure` (always trigger)

**Exit Codes:**
- `0` = Success (invoked or skipped based on triggers)
- `1` = Error
- `2` = Invalid arguments

---

## Integration with Hooks

### Example: Post-Edit Hook

```bash
#!/bin/bash
# .claude/hooks/post-edit.sh

FILE="$1"
PROJECT="nfl-predictor"

# Record event and check if Iris should be invoked
npm run iris:auto-invoke -- \
  --event file_edit \
  --file "$FILE" \
  --project "$PROJECT"
```

### Example: Post-Training Hook

```bash
#!/bin/bash
# hooks/post-training.sh

EXPERT_ID="$1"
PROJECT="$2"

# Record training event and check triggers
npm run iris:auto-invoke -- \
  --event model_train \
  --expert "$EXPERT_ID" \
  --project "$PROJECT"
```

### Example: Scheduled Batch Evaluation

```bash
#!/bin/bash
# cron-iris-batch.sh

# Run daily batch evaluation from queue
npm run iris:evaluate-batch -- \
  --queue /var/iris/queue.jsonl \
  --output-dir /var/iris/reports \
  --clear-on-success
```

---

## Data Storage

### Event History
- **Path:** `{dbBasePath}/iris-event-history.jsonl`
- **Format:** JSONL (one event per line)
- **Retention:** Events within time window (default: 1 hour)

### Last Invocation Tracking
- **Path:** `{dbBasePath}/iris-last-invocation.json`
- **Format:** JSON object mapping project → timestamp
- **Purpose:** Enforce cooldown periods

### Logs
- **Default Path:** `./logs/iris-evaluate.log`, `./logs/iris-evaluate-batch.log`, `./logs/iris-auto-invoke.log`
- **Format:** Timestamped log entries
- **Rotation:** Manual (consider using logrotate)

---

## Performance Characteristics

### `iris-evaluate`
- **Typical Duration:** 2-10 seconds (depends on project size)
- **Resource Usage:** Moderate (reads/writes to AgentDB)

### `iris-evaluate-batch`
- **Typical Duration:** 5-30 seconds (depends on project count)
- **Resource Usage:** Moderate to high (multiple evaluations)

### `iris-auto-invoke`
- **Typical Duration:** <100ms (decision-making only)
- **Invocation Duration:** 2-10 seconds (when triggered)
- **Resource Usage:** Very low for checks, moderate when invoking

---

## Error Handling

All scripts:
- Log errors to both console and log files
- Attempt to persist telemetry to Supabase (gracefully fail if unavailable)
- Use proper exit codes for integration with CI/CD
- Preserve partial results on failure

---

## Examples

### Manual Single Project Evaluation
```bash
npm run iris:evaluate -- --project nfl-predictor --verbose
```

### Batch Evaluation with Reports
```bash
npm run iris:evaluate-batch -- \
  --queue .claude/iris-queue.jsonl \
  --output-dir ./reports \
  --verbose
```

### Auto-Invoke from Hook (Fast Check)
```bash
npm run iris:auto-invoke -- \
  --event file_edit \
  --file src/experts/analyst.ts \
  --project nfl-predictor
```

### Force Evaluation (Bypass Triggers)
```bash
npm run iris:auto-invoke -- \
  --event file_edit \
  --project nfl-predictor \
  --force
```

### Dry Run (Test Without Executing)
```bash
npm run iris:auto-invoke -- \
  --event drift_detected \
  --project microbiome-platform \
  --dry-run \
  --verbose
```

---

## Best Practices

1. **Use `iris-auto-invoke` in hooks** for fast, intelligent triggering
2. **Use `iris-evaluate` for manual or scheduled evaluations** of specific projects
3. **Use `iris-evaluate-batch` for processing accumulated events** from queue files
4. **Enable `--verbose` during development** to understand trigger behavior
5. **Monitor log files** for errors and performance issues
6. **Set appropriate trigger thresholds** based on your project cadence
7. **Use `--dry-run`** to test trigger logic without running evaluations

---

## Troubleshooting

### "Queue file not found"
- Ensure queue file exists before running `iris-evaluate-batch`
- Use `--dry-run` to test queue parsing

### "Cooldown period active"
- Normal behavior to prevent excessive evaluations
- Use `--force` to bypass cooldown if needed

### "Threshold not met"
- Event count hasn't reached trigger threshold
- Check event history: `cat data/iris/iris-event-history.jsonl`

### "Supabase not initialized"
- Non-fatal warning, telemetry will be skipped
- Configure Supabase credentials if needed

---

## Future Enhancements

- [ ] Configurable trigger thresholds via config file
- [ ] Multi-project parallel evaluation in batch mode
- [ ] Integration with notification systems (WhatsApp, Slack)
- [ ] Dashboard visualization of event history
- [ ] Automatic queue cleanup (TTL-based)
