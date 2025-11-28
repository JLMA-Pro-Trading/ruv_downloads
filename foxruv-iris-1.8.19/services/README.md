# Iris Optimizer Services

This directory contains Python services that extend Iris with advanced optimization capabilities.

## Ax Optimization Service

FastAPI service that exposes Ax Bayesian optimization via HTTP REST API.

### Installation

```bash
pip install -r requirements.txt
```

### Running the Service

```bash
# Start service on port 8001
python ax_service.py

# Or with custom port
uvicorn ax_service:app --host 0.0.0.0 --port 8001
```

### Health Check

```bash
curl http://localhost:8001/health
```

### API Endpoints

- `POST /create_experiment` - Create new Bayesian optimization experiment
- `GET /get_next_trial/{experiment_id}` - Get next configuration to evaluate
- `POST /complete_trial/{experiment_id}/{trial_index}` - Report trial results
- `GET /get_best/{experiment_id}` - Get best configuration found
- `POST /save_checkpoint/{experiment_id}` - Save experiment to JSON
- `POST /load_checkpoint` - Load experiment from JSON

### Usage from TypeScript

```typescript
import { OptimizerRegistry } from '@foxruv/iris'

const optimizer = await OptimizerRegistry.get('ax')
const result = await optimizer.optimize(searchSpace, evaluationFn)
```

See `examples/ax-optimizer-test.ts` for complete example.

## Future Services

- `dspy_service.py` - DSPy prompt optimization service (Phase 3)
- `ray_service.py` - Ray Tune distributed optimization (Phase 4)
